import { SyncPipelineProcessor, SyncPipelineProcessorConfig, SyncPipelineProcessorResults } from '../SyncPipelineProcessor';
import { Lcc, LccDoc, Item, ItemDoc, ScType } from '../../../db/models';
import { LogAdditions } from '../../log';
import { QueryCursor } from 'mongoose';
import { ObjectId } from 'mongodb';

import * as request from 'request-promise-native';
import * as crypto from 'crypto';

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

const DEFAULT_ITEM_PAGE_SIZE = 5;
const DEFAULT_PAUSE_BETWEEN_LCC = 30000;

/**
 * FromScienceBase configuration options.
 */
export interface FromScienceBaseConfig extends SyncPipelineProcessorConfig {
    /** How many items to fetch from sciencebase at a time when syncing projects/products (default 5) */
    pageSize?:number;
    /** How long to pause (milliseconds) beween syncing LCCs (default 30000).  This option exists to avoid
        putting too much sustained pressure on ScienceBase.  If too many requests arrive too close together
        the ScienceBase API will return a 429 which terminates the sync process. */
    pauseBetweenLcc?:number;
    /** Whether items should be forcibly updated with the most recent mdJson even if no change is detected */
    force?:boolean;
    /** FOR TESTING ONLY: Used for testing to randomly modify incoming items so their has changes */
    randMod?:boolean;
}

/**
 * Logging codes used by this processor.
 */
export enum FromScienceBaseLogCodes {
    LCC_STARTED = 'lcc_started',
    LCC_COMPLETED = 'lcc_completed',
    LCC_ERROR = 'lcc_error',
    ITEM_CREATED = 'item_created',
    ITEM_UPDATED = 'item_updated',
    ITEM_UNCHANGED = 'item_unchanged',
    ITEM_DELETED = 'item_deleted',
    ITEM_IGNORED = 'item_ignored',
    ITEM_ERROR = 'item_error'
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
 *
 * @todo Support sync of `product` as well as `project`
 * @todo Handle deleted items from sciencebase
 * @todo Why are the numbers for `randModded` and `updated` not the same when `randMod` is enabled?
 * @todo Test `If-Modified-Since` request for `mdJson` document.
 */
export default class FromScienceBase extends SyncPipelineProcessor<FromScienceBaseConfig,ItemCounts[]> {
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
                            setTimeout(() => this.lccSync(lcc).then(next).catch(reject),pause);
                        }).catch(reject);
                };
            next();
        });
    }

    private lccSync(lcc:LccDoc):Promise<ItemCounts> {
        return new Promise((_resolve,_reject) => {
            let logAdditions:LogAdditions = {
                _lcc: lcc._id
            };
            this.log.info(`Starting LCC [${lcc._id}] "${lcc.title}"`,{...logAdditions,code:FromScienceBaseLogCodes.LCC_STARTED});
            let complete = () => {
                    lcc.lastSync = new Date();
                    return lcc.save();
                },
                resolve = (counts:ItemCounts) => {
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
                        data:err
                    });
                    complete()
                    .then(() => _reject(err))
                    .catch((e) => {
                        console.error(e);
                        _reject(err);
                    });
                },
                counts = new ItemCounts(lcc),
                importOnePage = (response) => {
                    counts.pages++;
                    response = JSON.parse(response);
                    let next = () => {
                            if(response.nextlink && response.nextlink.url) {
                                request(response.nextlink.url).then(importOnePage).catch(reject);
                            } else {
                                resolve(counts.finish());
                            }
                        },
                        items = response.items,
                        promises = items.map(i => this.projectSync(i,lcc,counts));
                    counts.total += items.length;
                    if(promises.length) {
                        // wait for them to complete
                        Promise.all(promises)
                            .then(next)
                            .catch(reject);
                    } else {
                        next();
                    }
                };
            // get the ball rolling
            request({
                    url: `https://www.sciencebase.gov/catalog/items`,
                    qs: {
                        fields: 'title,files',
                        filter0: `browseCategory=Project`,
                        filter1: 'tags=LCC Network Science Catalog',
                        filter2: `ancestors=${lcc._id}`,
                        sort: 'lastUpdated',
                        order: 'desc',
                        format: 'json',
                        max: (this.config.pageSize||DEFAULT_ITEM_PAGE_SIZE)
                    }
                })
                .then(importOnePage)
                .catch(reject);
        });
    }

    private projectSync(item:any,lcc:LccDoc,counts:ItemCounts) {
        return new Promise((_resolve,_reject) => {
            let logAdditions:LogAdditions = {
                _lcc: lcc._id,
                _item: item.id
            },
            resolve = (o,code:FromScienceBaseLogCodes) => {
                this.log.info(`[${code}][${item.id}] "${item.title}"`,{...logAdditions,code: code});
                switch(code) {
                    case FromScienceBaseLogCodes.ITEM_CREATED:
                        counts.created++;
                        break;
                    case FromScienceBaseLogCodes.ITEM_UPDATED:
                        counts.updated++;
                        break;
                    case FromScienceBaseLogCodes.ITEM_DELETED:
                        counts.deleted++;
                        break;
                    case FromScienceBaseLogCodes.ITEM_UNCHANGED:
                        counts.unchanged++;
                        break;
                    case FromScienceBaseLogCodes.ITEM_IGNORED:
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
                    data: err
                });
                _reject(err);
            };

            let mdJsonUrl = item.files ? item.files.reduce((found,f) => {
                    return found||(f.name === 'md_metadata.json' ? f.url : undefined);
                },undefined) : undefined;
            if(!mdJsonUrl) { // project not suitable for import TODO detect if this document was previously sync'ed in.
                return resolve(null,FromScienceBaseLogCodes.ITEM_IGNORED);
            }
            request(mdJsonUrl)
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
                        mdJson = JSON.parse(json);
                    sha1.update(json);
                    let catalog_item = {
                        _id: new ObjectId(item.id),
                        _lcc: lcc._id,
                        title: item.title,
                        scType: ScType.PROJECT,
                        hash: sha1.digest('hex'),
                        mdJson: mdJson,
                    };

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
                .catch(reject);
        });
    }
}
