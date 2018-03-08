import { SyncPipelineProcessor, SyncPipelineProcessorConfig, SyncPipelineProcessorResults } from '../SyncPipelineProcessor';
import { Item, ItemDoc, LccIfc } from '../../../db/models';
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
    /** If the process should forcibly re-simplify all documents */
    force?: boolean;
}

/**
 *
 */
export enum SimplificationCodes {
    SIMPLIFIED = 'simplified'
}

/**
* Translates the processor output into a report string.
*
* @param results The output of the Simplification SyncPipelineProcessor.
* @returns A string representation.
 */
export function simplificationReport(output:SimplificationOutput) {
    return `simplified ${output.total} items`;
}

export default class Simplification extends SyncPipelineProcessor<SimplificationConfig,SimplificationOutput> {
    run():Promise<SyncPipelineProcessorResults<SimplificationOutput>> {
        return new Promise((resolve,reject) => {
            this.results.results = new SimplificationOutput();
            let criteria =
                (this.config.force || !this.procEntry.lastComplete) ?
                    // either first run or asked to do all
                    {} :
                    {$or:[{
                        // changed since last sync
                        modified: {$gt: this.procEntry.lastComplete}
                    },{
                        // or don't have simplified documents
                        // this shouldn't be necessary since mongoose should
                        // set modified to created so new documents should
                        // be picked up above
                        simplified: {$exists: false }
                    }]};
            let cursor:QueryCursor<ItemDoc> = Item
                    .find(criteria)
                    .populate(['_lcc'])
                    .cursor(),
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
        let mdJson = item.mdJson,
            lcc = item._lcc as LccIfc;
        item.simplified = {
            title: mdJson.metadata.resourceInfo.citation.title,
            lcc: lcc.title,
            abstract: mdJson.metadata.resourceInfo.abstract,
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
