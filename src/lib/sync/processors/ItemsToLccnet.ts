import { SyncPipelineProcessorResults } from '../SyncPipelineProcessor';
import { LccnetWriteProcessorConfig, LccnetWriteProcessor } from './LccnetWriteProcessor';

import { Item, ScType } from '../../../db/models';
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

/**
 * For all items in the `Item` collection update the parallel nodes in the lccnetwork Drupal instance.
 * Loads all projects/products with sbids set in lccnetwork prior to the sync to know which need
 * creating/updating.  As existing items are updated their ids are removed from the list and when complete
 * any left over sbids are then deleted from lccnetwork because they no longer exist in the catalog.  As
 * nodes are created in lccnetwork.org the `lccnet` property is set on the corresponding document in the `Item`
 * to allow for linking directly to the lccnetwork.org view for the science-catalog item.
 * 
 * @todo This processor could be faster by batching requests it does all work serially.  Going the current route
 * does put less pressure on the lccnetwork site and technically speed is not a big deal.
 */
export default class ItemsToLccnet extends LccnetWriteProcessor<ItemsToLccnetConfig,ItemsToLccnetOutput> {
    /**
     * Execute the processor.
     */
    run():Promise<SyncPipelineProcessorResults<ItemsToLccnetOutput>> {
        this.results.results = new ItemsToLccnetOutput();
        return this.cronHack()
            .then(() => this.startSession())
            .then(session => this.crawlLccnet('/api/v1/lcc?$select=id,sbid&$top=100'))
            .then(lccs => {
                const lccMap = lccs.reduce((map,lcc) => {
                        map[lcc.sbid] = lcc.id;
                        return map;
                    },{});
                return this.syncType(ScType.PROJECT,lccMap)
                    .then(() => this.syncType(ScType.PRODUCT,lccMap))
                    .then(() => this.results);
            });
    }

    /**
     * Syncs all project or product items.
     * 
     * @param scType The type of of items to sync.
     * @param lccMap Map of sbid to lcc entry from lccnetwork.
     */
    private syncType(scType:ScType,lccMap:any):Promise<void> {
        const lccnetType = scType === ScType.PROJECT ? 'project' : 'resource',
        crawlUrl = `/api/v1/${lccnetType}?$select=id,sbid,archived,_links,lccs,cooperators,people&$include_archived&$filter=sbid ne 'NULL'&$top=500`;
        return this.log.info(`${scType === ScType.PROJECT ? 'Project' : 'Product'} sync started`,{
            code: scType === ScType.PROJECT ?
                ItemsToLccnetLogCodes.PROJECT_SYNC_STARTED :
                ItemsToLccnetLogCodes.PRODUCT_SYNC_STARTED
            })
            .then(() => this.crawlLccnet(crawlUrl))
            .then(items => {
                this.log.debug(`Found ${items.length} ${scType} items in ${this.config.lccnetwork}`);
                const sbidToItem = items.reduce((map,i) => {
                            map[i.sbid] = i;
                            return map;
                        },{}),
                        sbids = Object.keys(sbidToItem);
                // dealing with items serially to avoid overloading lccnet
                return Item.find({scType:scType}).cursor()
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
                        const sbid = item._id.toString(),
                                lccnetContacts = (item.simplified.contacts||[]).filter(c => !!c.lccnet),
                                lccNids = item._lccs.map(id => lccMap[id.toString()]).filter(nid => !!nid);
                        if(!lccNids.length) {
                            return this.log.warn(`Unable to find lccnet lcc/s with ids ${item._lccs}`,{...logAdditions,
                                    code: ItemsToLccnetLogCodes.LCCNET_MISSING_LCC
                                });
                        }
                        const lccnetUpdate:any = {
                                sbid: sbid,
                                title: item.simplified.title,
                                body: item.simplified.abstract,
                                people: lccnetContacts.filter(c => !c.isOrganization).map(c => c.lccnet.id),
                                cooperators: lccnetContacts.filter(c => c.isOrganization).map(c => c.lccnet.id),
                                lccs:lccNids
                            },
                            sbidIndex = sbids.indexOf(sbid),
                            lccnetItem = sbidToItem[sbid];
                        return ((sbidIndex !== -1)
                            ? this.session.update(lccnetItem._links.self,lccnetUpdate)
                            : this.session.create(`/api/v1/${lccnetType}`,lccnetUpdate))
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
                                    return this.log.error(`Received non 200 status ${error.statusCode}`,{
                                        ...logAdditions,
                                        code: ItemsToLccnetLogCodes.LCCNET_NON200_RC,
                                        data: {
                                            item: lccnetItem,
                                            updates: lccnetUpdate
                                        }
                                    })
                                    .then(() => {throw new Error(`Lccnet error ${error.statusCode}`)});
                                }
                                throw new Error(`Unexpected error`);// if say a mongo error may be recursive ${JSON.stringify(error)}`);
                            });
                    })
                    .then(() => {
                        // whatever is left in the sbids list need to then be deleted
                        // because it doesn't exist in the catalog, do sequentially
                        return sbids.map(sbid => () => {
                                const lccnetId = sbidToItem[sbid].id;
                                return this.session.delete(`/api/v1/${lccnetType}/${lccnetId}`)
                                    .then(() => this.results.results[`${scType === ScType.PROJECT ? 'projects' : 'products'}Deleted`]++)
                                    .then(() => this.log.info(`Deleted item with lccnet id ${sbid}/${lccnetId}`,{
                                            code: scType === ScType.PROJECT ?
                                                ItemsToLccnetLogCodes.PROJECT_DELETED :
                                                ItemsToLccnetLogCodes.PRODUCT_DELETED
                                        }));
                            })
                            .reduce((p,f) => p.then(f), Promise.resolve());
            });
        });
    }
}
