import { SyncPipelineProcessor, SyncPipelineProcessorConfig, SyncPipelineProcessorResults } from '../SyncPipelineProcessor';
import { Item,
         ItemDoc,
         LccIfc,
         SimplifiedKeywords,
         SimplifiedContact } from '../../../db/models';
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
    SIMPLIFIED = 'simplified',
    MISSING_CONTACT = 'missing_contact',
    MISSING_KEYWORDS = 'missing_keywords',
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
        // keyword isn't required but...
        if(!mdJson.metadata.resourceInfo.keyword) {
            this.log.warn(`[${SimplificationCodes.MISSING_KEYWORDS}][${item._id}]`,{
                _item: item._id,
                _lcc: item._lcc._id,
                code: SimplificationCodes.MISSING_KEYWORDS
            });
        }
        item.simplified = {
            title: mdJson.metadata.resourceInfo.citation.title,
            lcc: lcc.title,
            abstract: mdJson.metadata.resourceInfo.abstract,
            keywords: (mdJson.metadata.resourceInfo.keyword||[]).reduce((map,k):SimplifiedKeywords => {
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
                keywords: {},
            }),
            contacts: mdJson.metadata.resourceInfo.pointOfContact.reduce((map,poc) => {
                map[poc.role] = map[poc.role] || [];
                this.simplifyContacts(poc.party.map(ref => ref.contactId),item)
                    .forEach(c => map[poc.role].push(c));
                return map;
            },{}),
        };
        return item.save();
    }

    private simplifyContacts(contactIds:string[],item:ItemDoc) {
        return contactIds
            .map(id => this.simplifyContact(id,item))
            .filter(c => !!c); // missing contacts happen
    }

    private simplifyContact(contactId:string,item:ItemDoc):SimplifiedContact {
        let contacts = item.mdJson.contact,
            c = contacts.reduce((found,c) => found||(c.contactId === contactId ? c : undefined),undefined);
        if(!c) {
            this.log.warn(`[${SimplificationCodes.MISSING_CONTACT}][${item._id}] "${contactId}"`,{
                _item: item._id,
                _lcc: item._lcc._id,
                code: SimplificationCodes.MISSING_CONTACT
            });
            return null;
        }
        let { name, positionName, isOrganization, electronicMailAddress } = c;
        let contact:SimplifiedContact = {
            name: name,
            positionName: positionName,
            isOrganization: isOrganization,
            electronicMailAddress: electronicMailAddress
        };
        if(c.memberOfOrganization) {
            // missign contacts happen...
            let orgs = this.simplifyContacts(c.memberOfOrganization,item);
            if(orgs.length) {
                contact.memberOfOrganization = orgs;
            }
        }
        return contact;
    }
}
