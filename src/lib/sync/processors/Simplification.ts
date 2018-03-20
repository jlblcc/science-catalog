import { SyncPipelineProcessor, SyncPipelineProcessorConfig, SyncPipelineProcessorResults } from '../SyncPipelineProcessor';
import { Item,
         ItemDoc,
         ScType,
         LccIfc,
         SimplifiedKeywords,
         SimplifiedContact,
         SimplifiedFunding,
         Contact,
         ContactDoc } from '../../../db/models';
import { LogAdditions } from '../../log';
import { QueryCursor } from 'mongoose';
import * as moment from 'moment-timezone';

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
 * Logging codes for the Simplification SyncPipelineProcessor
 */
export enum SimplificationCodes {
    SIMPLIFIED = 'simplified',
    MISSING_CONTACT = 'missing_contact',
    MISSING_KEYWORDS = 'missing_keywords',
    INVALID_FUNDING_TIMEPERIOD = 'invalid_funding_timeperiod',
    NON_USD_FUNDING_ALLOCATION = 'non_usd_funding_allocation',
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

/**
 * The `timePeriod` as used by `mdJson.metadata.funding[]`
 */
export interface FiscalTimePeriod {
    startDateTime: string;
    endDateTime?: string;
}

/**
 * Translates an ISO8601 into its fiscal year.
 *
 * @param d An ISO8601 formatted date string.
 * @returns The fiscal year for `d` or null.
 */
export function fiscalYear(d:string):number {
    if(d) {
        let m = moment(d).tz('UTC');
        // if >= october next year
        return m.year() + (m.month() >= 9 ? 1 : 0);
    }
    return null;
}

function _fiscalYears(period:FiscalTimePeriod) {
    let start = period ? period.startDateTime : null,
        end = period ? period.endDateTime : null,
        years:number[] = [];
    if(start) {
        let startYear = fiscalYear(start),
            endYear = fiscalYear(end);
        if(endYear && endYear < startYear) {
            throw new Error(`Invalid date range ${start} - ${end}`)
        } else if (!endYear) {
            endYear = startYear;
        }
        while(startYear <= endYear) {
            years.push(startYear++);
        }
    }
    return years;
}

/**
 * Translates a date range of ISO8601 formatted strings into the corresponding fiscal years.
 *
 * @param period The period or periods to get the fiscal year range for.
 * @param returns The array of fiscal years.
 */
export function fiscalYears(period:FiscalTimePeriod | FiscalTimePeriod[]):number[] {
    let yearRanges = (period instanceof Array ? period : [period]).map(p => _fiscalYears(p));
    if(!yearRanges.length) {
        return [];
    } else if (yearRanges.length === 1) {
        return yearRanges[0];
    }
    return yearRanges.reduce((years,range) => {
        range.filter(y => years.indexOf(y) === -1).forEach(y => years.push(y));
        return years;
    },[]).sort();
}

export default class Simplification extends SyncPipelineProcessor<SimplificationConfig,SimplificationOutput> {
    // used to capture which contactIds for a given item have had warnings issued to avoid
    // generating multiple log warnings for a given item (a contact may be simplified multiple
    // times for a given item like for contacts and again for funding sources/recipients)
    private warnedContactIds:string[] = [];
    private orgsMap:any;
    private nonOrgsMap:any;

    run():Promise<SyncPipelineProcessorResults<SimplificationOutput>> {
        return new Promise((_resolve,reject) => {
            let resolve = () => {
                delete this.orgsMap;
                delete this.nonOrgsMap;
                _resolve(this.results);
            };
            this.loadContacts()
                .then(() => {
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
                                        return resolve();
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
                })
                .catch(reject);
        });
    }

    private loadContacts():Promise<any> {
        this.orgsMap = {};
        this.nonOrgsMap = {};
        return new Promise((resolve,reject) => {
            Contact.find({})
                .exec()
                .then(contacts => {
                    // put all the contacts in a big map by their aliases
                    contacts.forEach(c => c.aliases.forEach((a:any) => {
                        let map = c.isOrganization ? this.orgsMap : this.nonOrgsMap;
                        /* @todo log a warning?? */
                        /*if(map[a]) {
                            console.warn(`The alias "${a}" is already mapped (org:${c.isOrganization})?`);
                        }*/
                        map[a] = c
                    }));
                    //console.log(`found ${contacts.length} contacts with ${Object.keys(this.orgsMap).length + Object.keys(this.nonOrgsMap).length} unique aliases`);
                    resolve();
                })
                .catch(reject);
        });
    }

    private simplify(item:ItemDoc):Promise<ItemDoc> {
        // reset warnedContactIds for each document
        this.warnedContactIds = [];

        let mdJson = item.mdJson,
            lcc = item._lcc as LccIfc,
            logAdditions:LogAdditions = {
                _item: item._id,
                _lcc: item._lcc.id
            };
        // keyword isn't required but...
        if(!mdJson.metadata.resourceInfo.keyword) {
            this.log.warn(`[${SimplificationCodes.MISSING_KEYWORDS}][${item._id}]`,{...logAdditions,
                    code: SimplificationCodes.MISSING_KEYWORDS
                });
        }

        item.simplified = {
            title: mdJson.metadata.resourceInfo.citation.title,
            lcc: lcc.title,
            abstract: mdJson.metadata.resourceInfo.abstract,
            keywords: (mdJson.metadata.resourceInfo.keyword||[]).reduce((map:SimplifiedKeywords,k):SimplifiedKeywords => {
                    if(k.keywordType) {
                        let typeLabel = k.keywordType,
                            typeKey = typeLabel
                                .trim()
                                .toLowerCase()
                                .replace(/[\.-]/g,'')
                                .replace(/\s+/g,'_');
                        // look through types to see if this one has been put in there yet
                        if(!map.types.filter(kt => kt.type === typeKey).length) {
                            map.types.push({
                                type: typeKey,
                                label: typeLabel
                            });
                        }
                        map.keywords[typeKey] = map.keywords[typeKey]||[];
                        k.keyword.forEach(kw => map.keywords[typeKey].push(kw.keyword.trim()));
                    }
                    return map;
                },{
                    types: [],
                    keywords: {},
                }),
            contacts: this.simplifyContacts(mdJson.contact.map(c => c.contactId),item),
            pointOfContact: mdJson.metadata.resourceInfo.pointOfContact.reduce((map,poc) => {
                    map[poc.role] = map[poc.role] || [];
                    if(!poc.party) {
                        console.log('no party?');
                        console.log(item);
                    }
                    this.simplifyContacts(poc.party.map(ref => ref.contactId),item,poc)
                        .forEach(c => map[poc.role].push(c));
                    return map;
                },{}),
            resourceType: mdJson.metadata.resourceInfo.resourceType, // just copy over as is
        };
        if(item.scType === ScType.PROJECT) {
            // there is one product that has funding but the requirements say
            // funding is project specific so assume that one product is an
            // unwanted anomaly
            item.simplified.funding = this.simplifyFunding(item);
        }
        if(mdJson.metadata.metadataInfo.metadataDate && mdJson.metadata.metadataInfo.metadataDate.length) {
            item.simplified.dates = mdJson.metadata.metadataInfo.metadataDate.reduce((dates,d) => {
                    if(d.date && d.dateType) {
                        // if there isn't a match in the schema then Mongoose will drop
                        dates[d.dateType] = moment(d.date).tz('UTC').toDate();
                    }
                    return dates;
                },{});
        }
        return item.save();
    }

    private simplifyFunding(item:ItemDoc):SimplifiedFunding {
        let mdJson = item.mdJson,
            funding = mdJson.metadata.funding;
        // if no funding then move on
        if(!funding || !funding.length) {
            return undefined;
        }
        let lcc = item._lcc as LccIfc,
            logAdditions:LogAdditions = {
                _item: item._id,
                _lcc: item._lcc.id
            },
            simplified:SimplifiedFunding = {
                amount: funding.reduce((total,f) => {
                                    return total + (f.allocation||[]).reduce((aSum,a) => {
                                            if(a.currency && a.currency !== 'USD') {
                                                this.log.warn(`[${SimplificationCodes.NON_USD_FUNDING_ALLOCATION}][${item._id}]`,{...logAdditions,
                                                        code: SimplificationCodes.NON_USD_FUNDING_ALLOCATION,
                                                        data: a
                                                    });
                                                return aSum;
                                            }
                                            return aSum+(a.amount||0);
                                        },0);
                                },0),
                matching: funding.reduce((matching,f) => {
                                    return matching||(f.allocation||[]).reduce((m,a) => m||(a.matching ? true : false),false)
                                },false)
            };
        // calculate fiscal years
        try {
            let timePeriods = funding
                .filter(f => !!f.timePeriod) // only those with timePeriods
                .map(f => f.timePeriod) as FiscalTimePeriod[];
            simplified.fiscalYears = fiscalYears(timePeriods);
        } catch (fiscalError) {
            // happens if someone has defined an invalid start/end range (bad data)
            this.log.warn(`[${SimplificationCodes.INVALID_FUNDING_TIMEPERIOD}][${item._id}]`,{...logAdditions,
                    code: SimplificationCodes.INVALID_FUNDING_TIMEPERIOD,
                    data: {
                        error: this.constructErrorForStorage(fiscalError),
                        funding: mdJson.metadata.funding
                    }
                });
        }
        // look for awardIds (funding[].allocation[].sourceAllocationId)
        simplified.awardIds = funding.reduce((ids,f) => {
                (f.allocation||[]).forEach((a) => {
                    if(a.sourceAllocationId && ids.indexOf(a.sourceAllocationId) === -1) {
                        ids.push(a.sourceAllocationId);
                    }
                });
                return ids;
            },[]);

        // generate funding sources/recipients
        const simplifyContacts = (key) => {
            const contacts:SimplifiedContact[] = [],
                duplicateContact = (c) => contacts.reduce((found,ec) => found||(this.equalContacts(c,ec) ? true : false),false);
            funding.forEach(f => {
                (f.allocation||[]).forEach(a => {
                    if(a[key]) {
                        let c = this.simplifyContact(a[key],item,a);
                        if(!duplicateContact(c)) {
                            contacts.push(c);
                        }
                    }
                });
            });
            return contacts;
        };
        simplified.sources = simplifyContacts('sourceId');
        simplified.recipients = simplifyContacts('recipientId');
        return simplified;
    }

    private simplifyContacts(contactIds:string[],item:ItemDoc,context?:any) {
        return contactIds
            .map(id => this.simplifyContact(id,item,context))
            .filter(c => !!c); // missing contacts happen
    }

    private simplifyContact(contactId:string,item:ItemDoc,context?:any):SimplifiedContact {
        let contacts = item.mdJson.contact,
            c = contacts.reduce((found,c) => found||(c.contactId === contactId ? c : undefined),undefined);
        if(!c) {
            // for a given item only issue one warning per missing contactId (array reset per item)
            if(this.warnedContactIds.indexOf(contactId) === -1) {
                this.warnedContactIds.push(contactId);
                this.log.warn(`[${SimplificationCodes.MISSING_CONTACT}][${item._id}] "${contactId}"`,{
                    _item: item._id,
                    _lcc: item._lcc._id,
                    code: SimplificationCodes.MISSING_CONTACT,
                    data: {
                        contacts: item.mdJson.contact,
                        missingContactId: contactId,
                        context: context
                    }
                });
            }
            return null;
        }
        let { name, positionName, isOrganization, electronicMailAddress, contactType } = c;
        let contactMap = isOrganization ? this.orgsMap : this.nonOrgsMap,
            mapped = contactMap[name.trim().toLowerCase()];
        let contact:SimplifiedContact = {
            contactId: contactId,
            name: mapped.name, // if this isn't found then we kind of want the pipeline to fail
            positionName: positionName,
            contactType: contactType ? contactType.toLowerCase() : undefined, // Using toLowerCase() to normalize (see comment below).
            isOrganization: isOrganization,
            electronicMailAddress: electronicMailAddress && electronicMailAddress.length ? electronicMailAddress : undefined,
        };
        // if a reference is known for this contact in lccnetwork, copy that over.
        if(mapped.lccnet) {
            contact.lccnet = mapped.lccnet;
        }
        if(c.memberOfOrganization) {
            // missign contacts happen...
            let orgs = this.simplifyContacts(c.memberOfOrganization,item,c);
            if(orgs.length) {
                contact.memberOfOrganization = orgs;
            }
        }
        return contact;
    }

    private equalContacts(c1:SimplifiedContact, c2:SimplifiedContact) {
        return c1.name === c2.name &&
            c1.positionName === c2.positionName &&
            c1.contactType === c2.contactType &&
            c1.isOrganization === c2.isOrganization;
        // not comparing electronicMailAddress or memberOfOrganization arrays
    }
    /*
db.Item.distinct('mdJson.contact.contactType')
[
	"Academic",
	"Federal",
	"NGO",
	"Research",
	"lcc",
	"academic",
	"federal",
	"Cooperator/Partner",
	"consortium",
	"Native/Tribal",
	"Private",
	"Foundation",
	"LCC",
	"Nonprofit",
	"Province",
	"State",
	"Unknown",
	"nonProfit",
	"Principal Investigator",
	"Consortium",
	"Lead Organization",
	"state",
	"Contact",
	"local",
	"private",
	"Co-Investigator",
	"foundation",
	"Point of Contact",
	"Author",
	"research",
	"Funding Agency",
	"Local",
	"Distributor",
	"tribal"
]
     */
}
