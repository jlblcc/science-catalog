import { SyncPipelineProcessor, SyncPipelineProcessorConfig, SyncPipelineProcessorResults } from '../SyncPipelineProcessor';
import { Lcc, LccDoc, Item, ItemDoc, ScType } from '../../../db/models';
import { Logger, LogAdditions } from '../../log';
import { QueryCursor } from 'mongoose';
import { ObjectId } from 'mongodb';

import * as request from 'request-promise-native';
import * as crypto from 'crypto';
import * as https from 'https';

const UPSERT_OPTIONS = {
    upsert: true,
    new: true
};

/**
 * For a given sync keeps track of item counts for a single lcc.
 */
export class ItemCounts {
    /** The LCC id */
    _id:string;
    /** The LCC title */
    title:string;
    /** The number of pages of items processed from sciencebase */
    pages = 0;
    /** The toltal number of items considered */
    total = 0;
    /** The number of items ignored (e.g. no mdJson) */
    ignored = 0;
    /** The number of items created in the science catalog */
    created = 0;
    /** The number of items updated in the science catalog */
    updated = 0;
    /** The number of items deleted from the science catalog */
    deleted = 0;
    /** The number of items that remain undchanged in the science catalog */
    unchanged = 0;
    /** The number of items randModed for testing purposes (to force updates) */
    randModed?:number;
    /** Whether the execution resulted in an error (See SyncPipelineProcessorLog for error) */
    error:boolean;
    /** The number of projects */
    projects = 0;
    /** The number of products */
    products = 0;
    /** When the LCC sync started */
    startMillis;
    /** When the LCC sync completed */
    endMillis;
    /** How long the sync took in seconds */
    timeSeconds;

    constructor(lcc:LccDoc) {
        this.startMillis = Date.now();
        this._id = lcc._id;
        this.title = lcc.title;
    }

    finish():ItemCounts {
        this.endMillis = Date.now();
        this.timeSeconds = (this.endMillis - this.startMillis)/1000;
        return this;
    }
};

const DEFAULT_ITEM_PAGE_SIZE = 20;
const DEFAULT_PAUSE_BETWEEN_LCC = 30000;
const DEFAULT_REQUEST_LIMIT = 200;
const DEFAULT_RETRY_AFTER = 120000;
const DEFAULT_MAX_RETRIES = 5;

/**
 * FromScienceBase configuration options.
 */
export interface FromScienceBaseConfig extends SyncPipelineProcessorConfig {
    /** How many items to fetch from sciencebase at a time when syncing projects/products (default 20) */
    pageSize?:number;
    /** How long to pause (milliseconds) beween syncing LCCs (default 60000).  This option exists to avoid
        putting too much sustained pressure on ScienceBase.  If too many requests arrive too close together
        the ScienceBase API will return a 429 which terminates the sync process. */
    pauseBetweenLcc?:number;
    /** How many sequential requests to run before pausing (`retryAfter`) for a period of time to stay beneath rat limiting (default 200) */
    requestLimit?:number;
    /** How long to pause after receiving a 429 (Too many requests) or whenever the request limit is hit (unless received a 'retry-after' header) (default 120000) */
    retryAfter?:number;
    /** The maximum number of times to retry a request that meets specific circumstances */
    maxRetries?:number;
    /** Whether items should be forcibly updated with the most recent mdJson even if no change is detected */
    force?:boolean;
    /** FOR TESTING ONLY: Used for testing to randomly modify incoming items so their has changes */
    randMod?:boolean;
}

/**
 * Logging codes used by the FromScienceBase processor.
 */
export enum FromScienceBaseLogCodes {
    /** An individual lcc sync has started */
    LCC_STARTED = 'lcc_started',
    /** An individual lcc sync has completed */
    LCC_COMPLETED = 'lcc_completed',
    /** An error occured while syncing an lcc */
    LCC_ERROR = 'lcc_error',
    /** An item has been created in the catalog */
    ITEM_CREATED = 'item_created',
    /** An item has been updated in the catalog */
    ITEM_UPDATED = 'item_updated',
    /** An item in the catalog has not changed since the last sync */
    ITEM_UNCHANGED = 'item_unchanged',
    /** Some items were deleted from the catalog.  When this happens it means
        the items were in the catalog when an LCC's sync was started but were
        not discovered in the current results pulled from ScienceBase */
    ITEMS_DELETED = 'items_deleted',
    /** An item was ignored (no `mdJson`) */
    ITEM_IGNORED = 'item_ignored',
    /** An error occured while an item was being syned */
    ITEM_ERROR = 'item_error',
    /** mdJson is associated with an item but sciencebase returned a 404 not found for its contents */
    ITEM_MDJSON_404 = 'item_mdjson_404',
    /** mdJson cannot be parsed */
    ITEM_MDJSON_PARSE = 'item_json_parse',
    /** An lcc's project sync has started */
    PROJECT_SYNC_STARTED = 'project_sync_started',
    /** An lcc's project sync has completed */
    PROJECT_SYNC_COMPLETED = 'project_sync_completed',
    /** A project to product association is missing the science base id */
    ASSOC_PRODUCT_MISSING_SBID = 'assoc_product_missing_sbid',
    /** A project to product association appears to have a bad science base id */
    ASSOC_PRODUCT_INVALID_SBID = 'assoc_product_invalid_sbid',
    /** An lcc's product sync has started */
    PRODUCT_SYNC_STARTED = 'product_sync_started',
    /** An lcc's product sync has completed */
    PRODUCT_SYNC_COMPLETED = 'product_sync_completed',
    /** The list of associated products found and returned from sciencebase do not match */
    PRODUCT_SYNC_MISSING_PRODUCTS = 'product_sync_missing_products',
};

/**
 * Translates the processor output into a report string.
 *
 * @param results The output of the FromScienceBase SyncPipelineProcessor.
 * @returns A string representation.
 */
export function fromScienceBaseReport(results:ItemCounts[]):string {
    return (results||[]).reduce((report:string,counts:ItemCounts) => {
        let lccSync = `[${counts._id}] "${counts.title}"`
        Object.keys(counts)
            .filter(k => k !== '_id' && k !== 'title')
            .forEach(k => lccSync += `\n  ${k} = ${counts[k]}`);
        return report+lccSync+"\n\n";
    },'');
}

/**
 * Handles synchronization of sciencebase items for LCCs.
 *
 * This processor looks up LCCs defined in the `Lcc` collection and then sync's
 * ScienceBase items for them.
 *
 * It produces on output `ItemCount[]`.
 */
export default class FromScienceBase extends SyncPipelineProcessor<FromScienceBaseConfig,ItemCounts[]> {
    requestCount:number = 0;
    waitingOnRetry:boolean = false;
    waitingOnRequestLimit:boolean = false;
    _agent:https.Agent;

    get requestLimit() { return (this.config.requestLimit||DEFAULT_REQUEST_LIMIT); }
    get retryAfter() { return (this.config.retryAfter||DEFAULT_RETRY_AFTER); }
    get pageSize() { return (this.config.pageSize||DEFAULT_ITEM_PAGE_SIZE); }
    get maxRetries() { return (this.config.maxRetries||DEFAULT_MAX_RETRIES); }

    get agent():https.Agent {
        if(!this._agent) {
            this._agent = new https.Agent({
                keepAlive: true,
                maxSockets: 5
            });
        }
        return this._agent;
    }
    destroyAgent() {
        if(this._agent) {
            this._agent.destroy();
        }
        this._agent = null;
    }

    run():Promise<SyncPipelineProcessorResults<ItemCounts[]>> {
        this.results.results = [];
        return new Promise((resolve,_reject) => {
            let reject = (err) => _reject(err),
                firstLcc = true,
                cursor:QueryCursor<LccDoc> = Lcc.find({}).cursor(),
                next = (counts?:ItemCounts) => {
                    if(counts) {
                        this.results.results.push(counts);
                    }
                    cursor.next()
                        .then((lcc:LccDoc) => {
                            if(!lcc) {
                                return resolve(this.results);
                            }
                            // pause between LCCs to give ScienceBase some breathing room.
                            // if LCCs are sync'ed too quickly then SB will eventually
                            // complain with a 429 "Too Many Requests" response.
                            // use pause before sync, not after so the processor
                            // can exit immediately upon completing the last LCC
                            // otherwise there is dead space at the end.
                            let pause = firstLcc ? 0 : (this.config.pauseBetweenLcc||DEFAULT_PAUSE_BETWEEN_LCC);
                            firstLcc = false;
                            if(pause) {
                                this.log.debug(`Pausing ${pause/1000} seconds between LCC syncs.`);
                            }
                            this.destroyAgent();
                            setTimeout(() => this.lccSync(lcc).then(next).catch(reject),pause);
                        }).catch(reject);
                };
            next();
        });
    }

    private retryPause(why:string):Promise<void> {
        if(why) {
            this.log.debug(`${why} (pausing ${this.retryAfter/1000} seconds)`);
        }
        return new Promise(resolve => setTimeout(resolve,this.retryAfter));
    }

    private request(input:any,retryAttempt?:number):Promise<any> {
        input = typeof(input) === 'string' ? { url: input } : input;
        return new Promise((resolve,reject) => {
            this.requestCount++;
            const go = () => {
                input.agent = this.agent;
                request(input)
                    .then(resolve)
                    .catch(err => {
                        if ( (!retryAttempt || (retryAttempt < (this.maxRetries+1))) &&
                             ((err.statusCode === 429 || err.statusCode === 503) || err.name === 'RequestError') ) {
                            retryAttempt = retryAttempt||0;
                            retryAttempt++;
                            this.waitingOnRetry = true;
                            this.destroyAgent();
                            return this.retryPause(
                                err.name === 'RequestError' ?
                                    `ScienceBase responded with request error "${err.message}" [retry attempt #${retryAttempt}]` :
                                    `ScienceBase responded with response code ${err.statusCode} [retry attempt #${retryAttempt}]`
                                ).then(() => {
                                    this.waitingOnRetry = false;
                                    return this.request(input,retryAttempt).then(resolve).catch(reject);
                                });
                        } else {
                            reject(err);
                        }
                    });
            };
            if(this.waitingOnRetry) {
                this.log.debug(`Waiting on retry, will wait ${this.retryAfter/1000} seconds before making request`);
                return this.retryPause('Waiting on retry').then(go);
            } else if (this.waitingOnRequestLimit || ((this.requestCount)%this.requestLimit === 0)) {
                let why = null;
                if(!this.waitingOnRequestLimit) {
                    this.waitingOnRequestLimit = true;
                    why = `Next request will be an interval of ${this.requestLimit}`;
                }
                return this.retryPause(why).then(() => {
                            this.waitingOnRequestLimit = false;
                            go();
                        });
            } else {
                setImmediate(go);
            }
        });
    }

    private lccSync(lcc:LccDoc):Promise<ItemCounts> {
        return new Promise((_resolve,_reject) => {
            let logAdditions:LogAdditions = {
                _lcc: lcc._id
            };
            this.log.info(`Starting LCC [${lcc._id}] "${lcc.title}"`,{...logAdditions,code:FromScienceBaseLogCodes.LCC_STARTED});
            let counts = new ItemCounts(lcc),
                complete = () => {
                    lcc.lastSync = new Date();
                    return lcc.save();
                },
                resolve = () => {
                    counts.finish();
                    this.log.info(`[${FromScienceBaseLogCodes.LCC_COMPLETED}][${lcc._id}] "${lcc.title}" in ${counts.total} seconds.`,{...logAdditions,
                        code: FromScienceBaseLogCodes.LCC_COMPLETED,
                        data:counts
                    });
                    complete()
                    .then(() => _resolve(counts))
                    .catch((err) => {
                        console.error(err);
                        _resolve(counts);
                    });
                },
                reject = (err) => {
                    this.log.error(`[${FromScienceBaseLogCodes.LCC_ERROR}][${lcc._id}] "${lcc.title}"`,{...logAdditions,
                        code: FromScienceBaseLogCodes.LCC_ERROR,
                        data: this.constructErrorForStorage(err),
                    });
                    complete()
                    .then(() => _reject(err))
                    .catch((e) => {
                        console.error(e);
                        _reject(err);
                    });
                };
            this.lccItemSync(lcc,counts,ScType.PROJECT)
                .then(() => this.lccItemSync(lcc,counts,ScType.PRODUCT))
                .then(resolve)
                .catch(reject);
        });
    }

    private lccItemSync(lcc:LccDoc,counts:ItemCounts,itemType:ScType):Promise<void> {
        return new Promise((_resolve,reject) => {
            let logAdditions:LogAdditions = {
                    _lcc: lcc._id
                },
                startLogCode = itemType === ScType.PROJECT ? FromScienceBaseLogCodes.PROJECT_SYNC_STARTED : FromScienceBaseLogCodes.PRODUCT_SYNC_STARTED,
                endLogCode = itemType === ScType.PROJECT ? FromScienceBaseLogCodes.PROJECT_SYNC_COMPLETED : FromScienceBaseLogCodes.PRODUCT_SYNC_COMPLETED;
            this.log.info(`[${startLogCode}][${lcc._id}] "${lcc.title}"`,{...logAdditions,code:startLogCode});
            let remainingIds = [],
                resolve = () => {
                    this.log.info(`[${endLogCode}][${lcc._id}] "${lcc.title}"`,{...logAdditions,code:endLogCode});
                    _resolve()
                },
                cleanup = () => {
                    if(remainingIds.length) {
                        // the items in this list were not found during the sync from ScienceBase which means they disappeared
                        // from ScienceBase since the last sync and should be deleted from the catalog.
                        Item.deleteMany({_id: {$in: remainingIds}})
                            .then(() => {
                                this.log.info(`[${FromScienceBaseLogCodes.ITEMS_DELETED}][${lcc._id}] "${lcc.title}"`,{...logAdditions,
                                    code:FromScienceBaseLogCodes.ITEMS_DELETED,
                                    data: remainingIds
                                });
                                counts.deleted += remainingIds.length;
                                resolve();
                            })
                            .catch(reject);
                    } else {
                        resolve();
                    }
                },
                importOnePage = (response) => {
                    counts.pages++;
                    response = JSON.parse(response);
                    let next = () => {
                            if(response.nextlink && response.nextlink.url) {
                                this.request(response.nextlink.url).then(importOnePage).catch(reject);
                            } else {
                                cleanup();
                            }
                        },
                        items = response.items,
                        promises = items.map(i => this.itemSync(i,lcc,counts,itemType));
                    counts.total += items.length;
                    if(promises.length) {
                        // wait for them to complete
                        Promise.all(promises)
                            .then(() => {
                                // no rejections, drop any item ids from the remainingIds list
                                items.forEach(i => {
                                    const idx = remainingIds.indexOf(i.id);
                                    if(idx !== -1) {
                                        remainingIds.splice(idx,1);
                                    }
                                });
                                setImmediate(next)
                            }) // clear call stack
                            .catch(reject);
                    } else {
                        setImmediate(next);
                    }
                };
                Item.find({_lcc:lcc._id,scType:itemType})
                    .select('_id')
                    .exec()
                    .then((existing) => {
                        // populate remainingIds with all the ids for this itemType that are currently in the catalog
                        remainingIds = existing.map(e => e._id.toString());
                        // get the ball rolling
                        this.request({
                            url: `https://www.sciencebase.gov/catalog/items`,
                            qs: {
                                fields: 'title,files',
                                lq: itemType === ScType.PROJECT ?
                                    'browseCategories:"Data" AND browseCategories:"Project"':
                                    'browseCategories:"Data" AND NOT browseCategories:"Project"',
                                filter: 'tagslq=tags.name:"LCC Network Science Catalog" AND tags.type:"Harvest Set"',
                                filter1: `ancestors=${lcc._id}`,
                                sort: 'lastUpdated',
                                order: 'asc',
                                format: 'json',
                                max: this.pageSize
                            }
                        })
                        .then(importOnePage)
                        .catch(reject);
                    })
                    .catch(reject);

        });
    }

    private itemSync(item:any,lcc:LccDoc,counts:ItemCounts,itemType:ScType) {
        return new Promise((_resolve,_reject) => {
            let logAdditions:LogAdditions = {
                _lcc: lcc._id,
                _item: item.id
            },
            resolve = (o,code:FromScienceBaseLogCodes,error?:boolean) => {
                if(error) {
                    this.log.error(`[${code}][${item.id}] "${item.title}"`,{...logAdditions,code: code,data:itemType});
                } else {
                    this.log.info(`[${code}][${item.id}] "${item.title}"`,{...logAdditions,code: code,data:itemType});
                }
                switch(itemType) {
                    case ScType.PROJECT:
                        counts.projects++;
                        break;
                    case ScType.PRODUCT:
                        counts.products++;
                        break;
                }
                switch(code) {
                    case FromScienceBaseLogCodes.ITEM_CREATED:
                        counts.created++;
                        break;
                    case FromScienceBaseLogCodes.ITEM_UPDATED:
                        counts.updated++;
                        break;
                    case FromScienceBaseLogCodes.ITEM_UNCHANGED:
                        counts.unchanged++;
                        break;
                    case FromScienceBaseLogCodes.ITEM_IGNORED:
                    case FromScienceBaseLogCodes.ITEM_MDJSON_404:
                    case FromScienceBaseLogCodes.ITEM_MDJSON_PARSE:
                        counts.ignored++;
                        break;
                    default:
                        console.error(`Unexpected code on project sync resolve [${code}][${item.id}] "${item.title}"`);
                }
                _resolve(o);
            },
            reject = (err) => {
                counts.error = true;
                this.log.error(`[${item.id}] "${item.title}"`,{...logAdditions,
                    code: FromScienceBaseLogCodes.ITEM_ERROR,
                    data: this.constructErrorForStorage(err)
                });
                _reject(err);
            };

            let mdJsonUrl = item.files ? item.files.reduce((found,f) => {
                    return found||(f.name === 'md_metadata.json' ? f.url : undefined);
                },undefined) : undefined;
            if(!mdJsonUrl) { // project not suitable for import TODO detect if this document was previously sync'ed in.
                return resolve(null,FromScienceBaseLogCodes.ITEM_IGNORED);
            }
            this.request(mdJsonUrl)
                .then((json => {
                    if(this.config.randMod) {
                        // this is strictly for testing purposes ~25% of the time
                        // randomly change the title in the mdJson so that the
                        // hash should change and an update be applied.
                        if((Math.floor(Math.random()*100)+1) < 25) {
                            let tmp = JSON.parse(json),
                                title = tmp.metadata.resourceInfo.citation.title,
                                nowMillis = (new Date()).getTime();
                            item.title = tmp.metadata.resourceInfo.citation.title = `${title} (${nowMillis})`;
                            this.log.debug(`TESTING[${item.id}]: title modified to ${title}`,logAdditions);
                            if(typeof(counts.randModed) === 'number') {
                                counts.randModed++;
                            } else {
                                counts.randModed = 1;
                            }

                            json = JSON.stringify(tmp);
                        }
                    }
                    let sha1 = crypto.createHash('sha1'),
                        mdJson;
                    try {
                        mdJson = JSON.parse(json);
                    } catch(parseE) {
                        this.log.error(`[${item.id}] "${item.title}"`,{...logAdditions,
                            code: FromScienceBaseLogCodes.ITEM_MDJSON_PARSE,
                            data: this.constructErrorForStorage(parseE)
                        });
                        return resolve(null,FromScienceBaseLogCodes.ITEM_MDJSON_PARSE);
                    }
                    sha1.update(json);
                    let catalog_item = {
                        _id: new ObjectId(item.id),
                        _lcc: lcc._id,
                        title: item.title,
                        scType: itemType,
                        hash: sha1.digest('hex'),
                        mdJson: mdJson,
                        files: item.files
                    };

                    if(itemType === ScType.PROJECT) {
                        // just look at associations to log warnings
                        FromScienceBase.findProductIds(mdJson,item,this.log,logAdditions);
                    }

                    Item.findById(catalog_item._id,(err,existing) => {
                        if(err) {
                            return reject(err);
                        }
                        if(this.config.force || !existing || existing.hash !== catalog_item.hash) {
                            Item.findOneAndUpdate({
                                _id: catalog_item._id
                            },catalog_item,UPSERT_OPTIONS,(err,o) => {
                                if(err){
                                    return reject(err);
                                }
                                resolve(o,existing ? FromScienceBaseLogCodes.ITEM_UPDATED : FromScienceBaseLogCodes.ITEM_CREATED);
                            });
                        } else {
                            resolve(existing,FromScienceBaseLogCodes.ITEM_UNCHANGED);
                        }
                    });
                }))
                .catch((errResponse) => {
                    if(errResponse.statusCode === 404) {
                        return resolve(null,FromScienceBaseLogCodes.ITEM_MDJSON_404,true);
                    }
                    reject(errResponse)
                });
        });
    }

    static findProductIds(mdJson:any,item?:any,log?:Logger,logAdditions?:LogAdditions):string[] {
        const productIds = [];
        (mdJson.metadata.associatedResource||[]).filter(r => r.associationType === 'product')
            .forEach(productAssociation => {
                let sbid = (productAssociation.resourceCitation.identifier||[]).reduce((found,ident) => {
                    return found||(ident.namespace === 'gov.sciencebase.catalog' ? ident.identifier : undefined);
                },undefined);
                // some instances the gov.sciencebase.catalog reference is found in the metadataCitation
                // rather than the resourceCitation (don't understand the difference).
                if(!sbid && productAssociation.metadataCitation) {
                    sbid = (productAssociation.metadataCitation.identifier||[]).reduce((found,ident) => {
                        return found||(ident.namespace === 'gov.sciencebase.catalog' ? ident.identifier : undefined);
                    },undefined)
                }
                if(sbid) {
                    if(/^[a-zA-Z,0-9]+$/.test(sbid)) {
                        if(productIds.indexOf(sbid) === -1) { // duplicates apparently happen
                            productIds.push(sbid);
                        }
                    } else if (log) {
                        log.warn(`[${FromScienceBaseLogCodes.ASSOC_PRODUCT_INVALID_SBID}][${item.id}] "${productAssociation.resourceCitation.title}" "${sbid}"`,{
                            ...logAdditions,
                            code: FromScienceBaseLogCodes.ASSOC_PRODUCT_INVALID_SBID,
                            data:productAssociation
                        });
                    }
                } else if (log) {
                    log.warn(`[${FromScienceBaseLogCodes.ASSOC_PRODUCT_MISSING_SBID}][${item.id}] "${productAssociation.resourceCitation.title}"`,{
                        ...logAdditions,
                        code: FromScienceBaseLogCodes.ASSOC_PRODUCT_MISSING_SBID,
                        data:productAssociation
                    });
                }
            });
            return productIds;
    }
}
