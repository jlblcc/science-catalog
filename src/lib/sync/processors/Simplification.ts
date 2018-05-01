import { SyncPipelineProcessor, SyncPipelineProcessorConfig, SyncPipelineProcessorResults } from '../SyncPipelineProcessor';
import { Item,
         ItemDoc,
         ScType,
         LccIfc,
         SimplifiedKeywords,
         SimplifiedContact,
         SimplifiedFunding,
         SimplifiedFundingAllocations, SimplifiedFundingAllocation,
         SimplifiedDates,
         Contact,
         ContactDoc } from '../../../db/models';
import FromScienceBase from './FromScienceBase';
import { LogAdditions } from '../../log';
import Contacts from './Contacts';
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
}

/**
 * Logging codes for the Simplification SyncPipelineProcessor
 */
export enum SimplificationCodes {
    /** An item has been simplified */
    SIMPLIFIED = 'simplified',
    /** An item has a contact reference that is not found in its own contacts */
    MISSING_CONTACT = 'missing_contact',
    /** `mdJson.metadata.resourceInfo.keyword` is not set */
    MISSING_KEYWORDS = 'missing_keywords',
    /** An item has an invalid funding time period */
    INVALID_FUNDING_TIMEPERIOD = 'invalid_funding_timeperiod',
    /** A funding allocation is not in USD and so has been excluded */
    NON_USD_FUNDING_ALLOCATION = 'non_usd_funding_allocation',
    /** Invalid date format (should not be used, moment does not consider just year to be an ISO 8601 valid date though it is).
        Year only dates have been special cased and assume January 1 of the given year */
    DATE_FORMAT = 'deprecated_date_format',
    /** A project points to another project via the product relationship */
    PROJECT_AS_PRODUCT = 'project_as_product',
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
    }
    return yearRanges.reduce((years,range) => {
        range.filter(y => years.indexOf(y) === -1).forEach(y => years.push(y));
        return years;
    },[]).sort().reverse();
}

// thisThatTheOther -> This that the other
export function camelToTitleCase(s:string):string {
    let title = '',i,c;
    for(i = 0; i < s.length; i++) {
        c = s.charAt(i);
        if(i === 0) {
            title += c.toUpperCase();
        } else if (/[A-Z]/.test(c)) {
            title += ` ${c.toLowerCase()}`;
        } else {
            title += c;
        }
    }
    return title;
}

/**
 * @todo `simplification.dates.sort`
 */
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
                    const itemSimplifyComplete = (i:ItemDoc) => {
                                    this.log.info(`[${SimplificationCodes.SIMPLIFIED}][${i._id}] "${i.title}"`,{
                                        _lcc: i._lcc,
                                        _item: i._id,
                                        code: SimplificationCodes.SIMPLIFIED
                                    });
                                    this.results.results.total++;
                                    return Promise.resolve();
                            },
                            simplify = (i:ItemDoc) => {
                                return this.simplify(i).then(itemSimplifyComplete);
                            };
                    // simplify products and then projects because there is a dependency (via combinedResourceType)
                    // in that direction.  always simplify the entire catalog since there are interdependencies
                    // between items and we cannot be certain what might have changed in related entities
                    let productCursor:QueryCursor<ItemDoc> = Item.find({scType:ScType.PRODUCT}).populate(['_lcc']).cursor(),
                        projectCursor:QueryCursor<ItemDoc> = Item.find({scType:ScType.PROJECT}).populate(['_lcc']).cursor();
                    productCursor.eachAsync(simplify)
                        .then(() => projectCursor.eachAsync(simplify).then(resolve))
                        .catch(reject);
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
            status: mdJson.metadata.resourceInfo.status.map(s => camelToTitleCase(s)),
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
            responsibleParty: (mdJson.metadata.resourceInfo.citation.responsibleParty||[]).reduce((map,poc) => {
                    map[poc.role] = map[poc.role] || [];
                    this.simplifyContacts(poc.party.map(ref => ref.contactId),item,poc)
                        .forEach(c => map[poc.role].push(c));
                    return map;
                },{}),
            resourceType: mdJson.metadata.resourceInfo.resourceType, // just copy over as is
            combinedResourceType: mdJson.metadata.resourceInfo.resourceType,
            lccnet: item.simplified ? item.simplified.lccnet : undefined, // keep if set previously
        };
        if(item.scType === ScType.PROJECT) {
            // there is one product that has funding but the requirements say
            // funding is project specific so assume that one product is an
            // unwanted anomaly
            item.simplified.funding = this.simplifyFunding(item);
        }
        item.simplified.dates = this.simplifyDates(item);
        // pick a date that the UI can sort on.
        item.simplified.dates.sort = item.simplified.dates.start||item.simplified.dates.publication;//||item.simplified.dates.creation;

        // if simplifying a project go and relate it to any child products
        if(item.scType === ScType.PROJECT) {
            const productIds = FromScienceBase.findProductIds(item.mdJson);
            if(productIds.length) {
                // TODO log the association has been made?
                return new Promise((resolve,reject) => {
                    Item.find({_id:{$in:productIds}})
                        .exec()
                        .then(items => {
                            // some projects appear to point to themselves as products, make sure no projects were found in the list
                            items = items.filter(i => {
                                    if(i.scType === ScType.PROJECT) {
                                        this.log.warn(`[${SimplificationCodes.PROJECT_AS_PRODUCT}][${item._id}] "${i._id}"`,{...logAdditions,
                                                code: SimplificationCodes.PROJECT_AS_PRODUCT
                                            });
                                        return false;
                                    }
                                    return true;
                                });
                            if(items.length) {
                                items.forEach(i => i._project = item._id);
                                item._products = items.map(i => i._id);
                                // build a combined list of resource types for the project that
                                // includes those of its children.
                                const combinedRt = item.simplified.combinedResourceType,
                                      hasRt = (rt) => {
                                          return combinedRt.reduce((has,t) =>
                                            has||(t.type === rt.type && t.name === rt.name ? true : false),
                                            false);
                                      };
                                items.forEach(i => {
                                    i.simplified.combinedResourceType.forEach(rt => {
                                        if(!hasRt(rt)) {
                                            combinedRt.push(rt);
                                        }
                                    });
                                });
                                item.simplified.combinedResourceType = combinedRt;
                                Promise
                                    .all(items.map(i => i.save()))
                                    .then(() => {
                                        item.save().then(resolve).catch(reject);
                                    })
                                    .catch(reject);
                            } else {
                                item.save().then(resolve).catch(reject);
                            }
                        })
                        .catch(reject);
                    });
            }
        }
        return item.save();
    }

    private simplifyDates(item:ItemDoc):SimplifiedDates {
        const mdJson = item.mdJson,
            timePeriod = mdJson.metadata.resourceInfo.timePeriod,
            logAdditions:LogAdditions = {
                _item: item._id,
                _lcc: item._lcc.id
            },
            dates:SimplifiedDates = {},
            dh = moment.deprecationHandler; // this deprecationHandler code is not documented by momentjs
        let currentDate;
        // will catch bad "deprecated" date warnings if they happen
        moment.deprecationHandler = (err,msg) => {
            this.log.warn(`[${SimplificationCodes.DATE_FORMAT}][${item._id}] "${currentDate}"`,{...logAdditions,
                    code: SimplificationCodes.DATE_FORMAT
                });
        };
        const toDate = (dateString:string):Date => {
                currentDate = dateString;
                if(/^\d{4}$/.test(currentDate)) {
                    // even though technically just a year is a valid ISO 8601 date moment dislikes them so make them January 1
                    currentDate = `${currentDate}-01-01`;
                }
                return moment(currentDate).tz('UTC').toDate();
            };
        if(timePeriod) {
            if(timePeriod.startDateTime) {
                dates.start = toDate(timePeriod.startDateTime);
            }
            if(timePeriod.endDateTime) {
                dates.end = toDate(timePeriod.endDateTime);
            }
        }
        // do not use mdJson.metadata.metadataDate, those dates are not about the underlying item
        (mdJson.metadata.resourceInfo.citation.date||[]).forEach(d => {
            if(d.date && d.dateType && !dates[d.dateType]) {
                // if there isn't a match in the schema then Mongoose will drop
                dates[d.dateType] = toDate(d.date);
            }
        });
        moment.deprecationHandler = dh; // put back the old deprecation handler (or at least unset this context specific one)
        return dates;
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
            allAllocations:any[] = funding.reduce((arr,f) => { // returning wrapper of { matching: boolean: allocation: SimplifiedFundingAllocation }
                    let fYears:number[];
                    if(f.timePeriod) {
                        try {
                            fYears = fiscalYears(f.timePeriod as FiscalTimePeriod);
                        } catch(fiscalError) {
                            // happens if someone has defined an invalid start/end range (bad data)
                            this.log.warn(`[${SimplificationCodes.INVALID_FUNDING_TIMEPERIOD}][${item._id}]`,{...logAdditions,
                                    code: SimplificationCodes.INVALID_FUNDING_TIMEPERIOD,
                                    data: {
                                        error: this.constructErrorForStorage(fiscalError),
                                        funding: mdJson.metadata.funding
                                    }
                                });
                        }
                    }
                    (f.allocation||[]).forEach(a => {
                        const alloc:SimplifiedFundingAllocation = {
                            fiscalYears: fYears,
                            amount: a.amount||0,
                            awardId: a.sourceAllocationId
                        };
                        if(a.currency && a.currency !== 'USD') {
                            this.log.warn(`[${SimplificationCodes.NON_USD_FUNDING_ALLOCATION}][${item._id}]`,{...logAdditions,
                                    code: SimplificationCodes.NON_USD_FUNDING_ALLOCATION,
                                    data: a
                                });
                            alloc.amount = 0;
                        }
                        if(a.sourceId) {
                            alloc.source = this.simplifyContact(a.sourceId,item,a);
                        }
                        if(a.recipientId) {
                            alloc.recipient = this.simplifyContact(a.recipientId,item,a);
                        }
                        arr.push({
                            matching: a.matching||false,
                            allocation: alloc
                        })
                    });
                    return arr;
                },[]),
            sortAllocations = (allocs:SimplifiedFundingAllocation[]):SimplifiedFundingAllocation[] => {
                    let maxYear:any[] = allocs.map(a => {
                        return {
                            y: (a.fiscalYears||[]).reduce((max,y) => y > max ? y : max, 0),
                            a: a
                        }
                    });
                    return maxYear.sort((a,b) => (b.y - a.y)).map(wrap => wrap.a);
                },
            allocations:SimplifiedFundingAllocations = {
                nonMatching: sortAllocations(allAllocations.filter(wrap => !wrap.matching).map(wrap => wrap.allocation)),
                matching: sortAllocations(allAllocations.filter(wrap => wrap.matching).map(wrap => wrap.allocation))
            },
            allAllocationsUnwrapped = allAllocations.map(wrap => wrap.allocation),
            duplicateContact = (c,contacts) => contacts.reduce((found,ec) => found||(this.equalContacts(c,ec) ? true : false),false);
        const simplified:SimplifiedFunding = {
            amount: allAllocationsUnwrapped.reduce((sum,a) => (sum+a.amount),0),
            fiscalYears: allAllocationsUnwrapped.reduce((years,a) => {
                    (a.fiscalYears||[]).forEach(y => {
                        if(years.indexOf(y) == -1) {
                            years.push(y);
                        }
                    })
                    return years;
                },[]).sort().reverse(),
            awardIds: allAllocationsUnwrapped.reduce((arr,a) => {
                    if(a.awardId && arr.indexOf(a.awardId) === -1) {
                        arr.push(a.awardId);
                    }
                    return arr;
                },[]),
            matching: allocations.matching.length ? true : false,
            sources: allAllocationsUnwrapped.reduce((arr,a) => {
                    if(a.source && !duplicateContact(a.source,arr)) {
                        arr.push(a.source);
                    }
                    return arr;
                },[]),
            recipients: allAllocationsUnwrapped.reduce((arr,a) => {
                    if(a.recipient && !duplicateContact(a.recipient,arr)) {
                        arr.push(a.recipient);
                    }
                    return arr;
                },[]),
            allocations: allocations
        };
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
        let { name, positionName, isOrganization, electronicMailAddress, contactType } = c,
            normalized = Contacts.normalize(name);
        let contactMap = isOrganization ? this.orgsMap : this.nonOrgsMap,
            mapped = contactMap[normalized[0]]; // any alias should do so use the first.
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
