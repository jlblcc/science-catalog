import { SyncPipelineProcessor, SyncPipelineProcessorConfig, SyncPipelineProcessorResults } from '../SyncPipelineProcessor';
import { Item, ItemDoc } from '../../../db/models';
import { LogAdditions } from '../../log';
import { QueryCursor } from 'mongoose';

/**
 * The output of the simplification processor.
 */
export class SimplificationOutput {
    total = 0;
}

/**
 * Configuration for the simplification processor.
 */
export interface SimplificationConfig extends SyncPipelineProcessorConfig {

}

/**
 *
 */
export enum SimplificationCodes {
    SIMPLIFIED = 'simplified'
}

export default class Simplification extends SyncPipelineProcessor<SimplificationConfig,SimplificationOutput> {
    run():Promise<SyncPipelineProcessorResults<SimplificationOutput>> {
        return new Promise((resolve,reject) => {
            this.results.results = new SimplificationOutput();
            console.log('procEntry',this.procEntry);
            let criteria = this.procEntry.lastComplete ?
                {$or:[{
                    // changed since last sync
                    modified: {$gt: this.procEntry.lastComplete}
                },{
                    // or don't have simplified documents
                    // ths shouldn't be necessary sine mongoose should
                    // set modified to created so new documents should
                    // be picked up above
                    simplified: {$exists: false }
                }]} : {}; // first run do all
            console.log('criteria',criteria);
            let cursor:QueryCursor<ItemDoc> = Item
                    .find(criteria).cursor(),
                next = () => {
                    cursor.next()
                        .then((item:ItemDoc) => {
                            if(!item) {
                                return resolve(this.results);
                            }
                            this.simplify(item)
                                .then((i:ItemDoc) => {
                                    this.log.info(`[${SimplificationCodes.SIMPLIFIED}][${i._id}] "${i.title}"`,{
                                        _lcc: i._lcc,
                                        _item: i._id,
                                        code: SimplificationCodes.SIMPLIFIED
                                    });
                                    this.results.results.total++;
                                    next();
                                }).catch(reject);
                        }).catch(reject);
                };
            next();
        });
    }

    private simplify(item:ItemDoc):Promise<ItemDoc> {
        let mdJson = item.mdJson;
        item.simplified = {
            title: mdJson.metadata.resourceInfo.citation.title,
            keywords: mdJson.metadata.resourceInfo.keyword.reduce((map,k) => {
                if(k.keywordType) {
                    let typeLabel = k.keywordType,
                        typeKey = typeLabel
                            .trim()
                            .toLowerCase()
                            .replace(/[\.-]/g,'')
                            .replace(/\s+/g,'_');
                    map.types[typeKey] = typeLabel;
                    map.keywords[typeKey] = map.keywords[typeKey]||[];
                    k.keyword.forEach(kw => map.keywords[typeKey].push(kw.keyword.trim()));
                }
                return map;
            },{
                types: {},
                keywords: {}
            })
        };
        return item.save();
    }
}
