import { SyncPipelineProcessorResults } from '../SyncPipelineProcessor';
import { LccnetWriteProcessorConfig, LccnetWriteProcessor } from './LccnetWriteProcessor';

import { Item, ScType, LccnetRef } from '../../../db/models';
import { LogAdditions } from '../../log';
/**
 * Configuration for the ItemsToLccnetConfig processor.
 */
export interface ItemsToLccnetConfig extends LccnetWriteProcessorConfig {

}

/**
 * The output of the LccnetItemsToLccnetOutput processor.
 */
export class ItemsToLccnetOutput {
    projectsCreated = 0;
    projectsUpdated = 0;
    projectsDeleted = 0;
    productsCreated = 0;
    productsUpdated = 0;
    productsDeleted = 0;
}

/**
 * Logging codes used by the ItemsToLccnet processor.
 */
export enum ItemsToLccnetLogCodes {
    /** Started the project sync */
    PROJECT_SYNC_STARTED = 'project_sync_started',
    /** Created a project in lccnet */
    PROJECT_CREATED = 'project_created',
    /** Updated a project in lccnet */
    PROJECT_UPDATED = 'project_updated',
    /** Deleted a project in lccnet */
    PROJECT_DELETED = 'project_deleted',

    PRODUCT_SYNC_STARTED = 'product_sync_started',
    /** Created a resource (product) in lccnet */
    PRODUCT_CREATED = 'product_created',
    /** Updated a resource (product) in lccnet */
    PRODUCT_UPDATED = 'product_updated',
    /** Deleted a resource (product) in lccnet */
    PRODUCT_DELETED = 'product_deleted',

    /** An item in the catalog was not simplified and so could not be synced (should not happen) */
    ITEM_NOT_SIMPLIFIED = 'item_not_simplified',
    /** An item refers to an lcc not in lccnetwork (should never happen) */
    LCCNET_MISSING_LCC = 'lccnet_missing_lcc',
    /** An update or create failed due to a non-200 rc */
    LCCNET_NON200_RC = 'lccnet_non200_rc',
}

/**
 * Translates process output into a report string.
 *
 * @param output The output of the processor.
 * @returns A string representation.
 */
export function itemsToLccnetReport(output:ItemsToLccnetOutput) {
    return `Projects created: ${output.projectsCreated}
Projects updated: ${output.projectsUpdated}
Projects deleted: ${output.projectsDeleted}
Products created: ${output.productsCreated}
Products updated: ${output.productsUpdated}
Products deleted: ${output.productsDeleted}
`;
}

export default class ItemsToLccnet extends LccnetWriteProcessor<ItemsToLccnetConfig,ItemsToLccnetOutput> {
    run():Promise<SyncPipelineProcessorResults<ItemsToLccnetOutput>> {
        this.results.results = new ItemsToLccnetOutput();
        return new Promise((resolve,reject) => {
            return this.cronHack()
                .then(() => {
                    return this.startSession()
                               .then(session => {
                                   return this.crawlLccnet('/api/v1/lcc?$select=id,sbid&$top=100')
                                    .then(lccs => {
                                        const lccMap = lccs.reduce((map,lcc) => {
                                                map[lcc.sbid] = lcc.id;
                                                return map;
                                            },{});
                                        return this.syncType(ScType.PROJECT,lccMap)
                                                   .then(() => {
                                                       return this.syncType(ScType.PRODUCT,lccMap)
                                                                 .then(() => {
                                                                     resolve(this.results);
                                                                 });
                                                   });
                                    });
                        });
                })
                .catch(err => {
                    console.error(err);
                    reject(err);
                });
        });
    }

    private syncType(scType:ScType,lccMap:any):Promise<void> {
        return new Promise((resolve,reject) => {
            this.log.info(`${scType === ScType.PROJECT ? 'Project' : 'Product'} sync started`,{
                code: scType === ScType.PROJECT ?
                    ItemsToLccnetLogCodes.PROJECT_SYNC_STARTED :
                    ItemsToLccnetLogCodes.PRODUCT_SYNC_STARTED
                });
            const lccnetType = scType === ScType.PROJECT ? 'project' : 'resource',
                  crawlUrl = `/api/v1/${lccnetType}?$select=id,sbid,archived,_links,lccs,cooperators,people&$include_archived&$filter=sbid ne 'NULL'&$top=500`;
            return this.crawlLccnet(crawlUrl)
                        .then(items => {
                            this.log.debug(`Found ${items.length} ${scType} items in ${this.config.lccnetwork}`);
                            const sbidToItem = items.reduce((map,i) => {
                                      map[i.sbid] = i;
                                      return map;
                                  },{}),
                                  sbids = Object.keys(sbidToItem);
                            // dealing with items serially to avoid overloading lccnet
                            Item.find({scType:scType})
                                .cursor()
                                .eachAsync(item => {
                                    const logAdditions:LogAdditions = {
                                        _lcc: item._lcc,
                                        _item: item._id
                                    };
                                    if(!item.simplified) {
                                        return this.log.warn(`Item has not been simplified`,{...logAdditions,
                                                code: ItemsToLccnetLogCodes.ITEM_NOT_SIMPLIFIED
                                            });
                                    }
                                    // returning a promise will result in the cursor waiting for that to complete
                                    // before sending the next document
                                    const sbid = item._id.toString(),
                                          lccnetContacts = (item.simplified.contacts||[]).filter(c => !!c.lccnet),
                                          lccNid = lccMap[item._lcc.toString()];
                                    if(!lccNid) {
                                        return this.log.warn(`Unable to find lccnet lcc with id ${item._lcc}`,{...logAdditions,
                                                code: ItemsToLccnetLogCodes.LCCNET_MISSING_LCC
                                            });
                                    }
                                    const lccnetUpdate:any = {
                                            sbid: sbid,
                                            title: item.simplified.title,
                                            body: item.simplified.abstract,
                                            people: lccnetContacts.filter(c => !c.isOrganization).map(c => c.lccnet.id),
                                            cooperators: lccnetContacts.filter(c => c.isOrganization).map(c => c.lccnet.id),
                                            lccs:[lccNid]
                                        },
                                        sbidIndex = sbids.indexOf(sbid),
                                        lccnetItem = sbidToItem[sbid];
                                    return ((sbidIndex !== -1) ?
                                                this.session.update(lccnetItem._links.self,lccnetUpdate) :
                                                this.session.create(`/api/v1/${lccnetType}`,lccnetUpdate))
                                            .then((updated:any) => {
                                                if(sbidIndex !== -1) {
                                                    // drop the sbid from the array so the object does not get deleted
                                                    sbids.splice(sbidIndex,1);
                                                }
                                                const whatHappened = sbidIndex === -1 ? 'Created' : 'Updated';
                                                this.results.results[`${scType === ScType.PROJECT ? 'projects' : 'products'}${whatHappened}`]++;
                                                this.log.info(`${whatHappened} item with lccnet id ${sbid}/${updated.id}`,{
                                                    ...logAdditions,
                                                    code: scType === ScType.PROJECT ?
                                                        (sbidIndex === -1 ? ItemsToLccnetLogCodes.PROJECT_CREATED : ItemsToLccnetLogCodes.PROJECT_UPDATED) :
                                                        (sbidIndex === -1 ? ItemsToLccnetLogCodes.PRODUCT_CREATED : ItemsToLccnetLogCodes.PRODUCT_UPDATED)
                                                });
                                                item.simplified.lccnet = {
                                                    id: updated.id,
                                                    url: this.pathFromUrl(updated._links.drupal_self)
                                                };
                                                return item.save();
                                            }).catch(error => {
                                                if(error.statusCode) { // lccnet responded with a non 200 status code
                                                    this.log.error(`Received non 200 status ${error.statusCode}`,{
                                                        ...logAdditions,
                                                        code: ItemsToLccnetLogCodes.LCCNET_NON200_RC,
                                                        data: {
                                                            item: lccnetItem,
                                                            updates: lccnetUpdate
                                                        }
                                                    }).then(() => {
                                                        reject(new Error(`Lccnet error ${error.statusCode}`));
                                                    });
                                                } else {
                                                    reject(error);
                                                }
                                            });
                                })
                                .then(() => {
                                    // whatever is left in the sbids list need to then be deleted
                                    // because it doesn't exist in the catalog
                                    const next = () => {
                                                if(!sbids.length) {
                                                    resolve();
                                                } else {
                                                    const sbid = sbids.pop(),
                                                          lccnetId = sbidToItem[sbid].id;
                                                    this.session.delete(`/api/v1/${lccnetType}/${lccnetId}`)
                                                        .then(() => {
                                                            this.results.results[`${scType === ScType.PROJECT ? 'projects' : 'products'}Deleted`]++;
                                                            this.log.info(`Deleted item with lccnet id ${lccnetId}`,{
                                                                code: scType === ScType.PROJECT ?
                                                                    ItemsToLccnetLogCodes.PROJECT_DELETED :
                                                                    ItemsToLccnetLogCodes.PRODUCT_DELETED
                                                            });
                                                            setTimeout(next);
                                                        }).catch(reject);
                                                }
                                            };
                                    next();
                                })
                                .catch(reject);
                        });
        });
    }
}
