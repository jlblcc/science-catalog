import { SyncPipelineProcessor, SyncPipelineProcessorConfig, SyncPipelineProcessorResults } from '../SyncPipelineProcessor';
import { Item,
         ItemDoc,
         ScType,
         LccIfc,
         Lcc,
         SimplifiedKeywords,
         SimplifiedContact,
         SimplifiedContactsMap,
         SimplifiedFunding,
         SimplifiedFundingAllocations, SimplifiedFundingAllocation,
         SimplifiedDates,
         SimplifiedExtent,
         Contact } from '../../../db/models';
import FromScienceBase from './FromScienceBase';
import { LogAdditions } from '../../log';
import Contacts from './Contacts';
import * as moment from 'moment-timezone';
import * as geojsonExtent from '@mapbox/geojson-extent';
import { ObjectId } from 'bson';

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
    /** An item has a recursive contact reference */
    RECURSIVE_CONTACT = 'recursive_contact',
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
    /** An error occured while attempting to simplify an item's geographic extent */
    GEOGRAPHIC_WARN = 'geographic_warn',
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
    startDateTime?: string;
    endDateTime?: string;
}

/**
 * Translates an ISO8601 into its fiscal year.
 *
 * @param d An ISO8601 formatted date string.
 * @returns The fiscal year for `d` or null.
 */
export function fiscalYear(d:string,end?:boolean):number {
    if(d) {
        // NOTE: Similar code exist down in Simplification.simplifyDates
        // but it attempts to catch any other potential deprecation warnings
        // and log them.
        if(/^\d{4}$/.test(d)) {
            // technically just a year is a valid ISO 8601 date but
            // moment will complain with a deprecation warning
            d = `${d}-01-01`;
        }
        let m = moment(d).tz('UTC');
        // the following two checks are due to the variety of timezones data
        // is being entered in vs where its being interpreted.  Either we
        // need to keep track of all LCC's timezone's and interpret dates relative to
        // those or allow this leeway of one day on start/end dates to allow for the
        // fact that a date's interpretation may shift one day based on the origin's
        // offset to UTC.  this solution is more simplistic and should work adequately.
        if(end && m.month() === 9 && m.date() === 1) {
            // end on Oct 1 not considered the next fiscal year
            return m.year();
        } else if (!end && m.month() === 8 && m.date() === 30) {
            // start on Sept 30 considered next fiscal year
            return m.year()+1;
        }
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
            endYear = fiscalYear(end,true);
        if(endYear && endYear < startYear) {
            throw new Error(`Invalid date range ${start} - ${end}`)
        } else if (!endYear) {
            endYear = startYear;
        }
        while(startYear <= endYear) {
            years.push(startYear++);
        }
    } else if (end) {
        // end with no start, schema says neither are required but
        // mdEditor requires end and not start
        years.push(fiscalYear(end,true));
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
function statusCamelToTitleCase(s:string):string {
    if(s === 'onGoing') {
        return 'Ongoing';
    }
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
    return title.replace(/\s+/,' '); // collapse multiple spaces
}

/**
 * Given mdJson collects and/or builds any GeoJson features from its contents.
 * For a given `geographicExtent` if a `geographicElement` is found it takes
 * it takes precedence.  If one is not found and a `boundingBox` is found then
 * a feature (`Polygon`) will be built from the bounding box.
 *
 * @param mdJson The mdJson document.
 * @returns A GeoJson feature collection or undefined.
 */
function collectedFeatures(mdJson) {
    const features = [];
    if (mdJson &&
        mdJson.metadata &&
        mdJson.metadata.resourceInfo &&
        mdJson.metadata.resourceInfo.extent) {

        mdJson.metadata.resourceInfo.extent.forEach(function(extent) {
            (extent.geographicExtent || []).forEach(function(ge) {
                if (ge.geographicElement && ge.geographicElement.length) {
                    ge.geographicElement.forEach(function(e) {
                        // unclear from adiwg schema if this will always be a feature
                        if (e.type === 'Feature') {
                            features.push(e);
                        } else if (e.type === 'FeatureCollection') {
                            e.features.forEach(function(f) {
                                features.push(f);
                            });
                        } else {
                            // wrap in a feature
                            features.push({
                                type: 'Feature',
                                geometry: e
                            });
                        }
                    });
                } else if (ge.boundingBox) {
                    // assume that if an element has both geographicElement
                    // and bounding box that the former represents the latter
                    const nLat = ge.boundingBox.northLatitude,
                        sLat = ge.boundingBox.southLatitude,
                        wLon = ge.boundingBox.westLongitude,
                        eLon = ge.boundingBox.eastLongitude;
                    if (nLat && sLat && wLon && eLon) {
                        const nw = [wLon, nLat],
                            ne = [eLon, nLat],
                            se = [eLon, sLat],
                            sw = [wLon, sLat];
                        features.push({
                            type: 'Feature',
                            geometry: {
                                type: 'Polygon',
                                coordinates: [[nw, ne, se, sw, nw]]
                            }
                        });
                    }
                }
            });
        });
    }
    return features.length ? {
        type: 'FeatureCollection',
        features: features.map(f => {
            // geojson-flatten is not tollerant of no properties....
            f.properties = f.properties||{};
            return f;
        })
    } : undefined;
}

interface NormalizedTitleToLccId {
    [normalizedTitle:string]: string; // id
}
interface LccIdToTitle {
    [id:string] : string; // original title
}
interface NormalizedLccInput {
    originals: LccIdToTitle;
    normalized: NormalizedTitleToLccId;
}

/**
 * These are keyword types explicitly asked to ignore and not expose
 * via the catalog.
 */
const EXCLUDED_KEYWORD_TYPES = [
    'community',
    'organization'
];

/**
 * Processor that performs simplification of mdJson documents stored in `Item.mdJson`.
 * This processor always unconditionally updates all Items.  It must always re-simplify all
 * items because while it may know which items have actually changed it cannot know how
 * other items may have affected the contact database or how project/product relationships
 * may have changed.  The processor simplifies all items of type product followed by all
 * items of type project due to how relationships between the two types of items are determined.
 */
export default class Simplification extends SyncPipelineProcessor<SimplificationConfig,SimplificationOutput> {
    // used to capture which contactIds for a given item have had warnings issued to avoid
    // generating multiple log warnings for a given item (a contact may be simplified multiple
    // times for a given item like for contacts and again for funding sources/recipients)
    private warnedContactIds:string[] = [];
    private orgsMap:any;
    private nonOrgsMap:any;
    private lccsPromise:Promise<NormalizedLccInput>;

    /**
     * Execute the processor.
     */
    run():Promise<SyncPipelineProcessorResults<SimplificationOutput>> {
        return this.loadContacts()
            .then(() => {
                this.results.results = new SimplificationOutput();
                const simplify = (i:ItemDoc) => this.simplify(i)
                        .then((i:ItemDoc) => {
                            this.log.info(`[${SimplificationCodes.SIMPLIFIED}][${i._id}] "${i.title}"`,{
                                _lcc: i._lcc,
                                _item: i._id,
                                code: SimplificationCodes.SIMPLIFIED
                            });
                            this.results.results.total++;
                        });
                // simplify products and then projects because there is a dependency (via combinedResourceType)
                // in that direction.  always simplify the entire catalog since there are interdependencies
                // between items and we cannot be certain what might have changed in related entities
                return Item.find({scType:ScType.PRODUCT}).populate(['_lcc']).cursor().eachAsync(simplify)
                    .then(() => Item.find({scType:ScType.PROJECT}).populate(['_lcc']).cursor().eachAsync(simplify).then(() => {
                        delete this.orgsMap;
                        delete this.nonOrgsMap;
                        return this.results;
                    }));
            });
    }

    /**
     * Load the entire `Contacts` collection into memory and build maps
     * of organizations, non-organizations where the keys are all possible aliases
     * to each `Contact` entry.  This way all contacts in all items can be normalized
     * and linked together based on common aliases so all `Item`s will be as consistent
     * as possible in their use of contacts.
     */
    private loadContacts():Promise<void> {
        this.orgsMap = {};
        this.nonOrgsMap = {};
        return Contact.find({}).exec()
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
                });
    }

    /**
     * Translate the `Item.mdJson` into `Item.simplified` and save the document.
     * 
     * @param item The item to simplify.
     */
    private simplify(item:ItemDoc):Promise<ItemDoc> {
        // seems it shouldn't be necessary but perhaps because of how eachAsync works need to wrap contents in a
        // Promise so that RTEs are properly handled and logged by the pipeline manager
        return new Promise((resolve,reject) => {
            // reset warnedContactIds for each document
            this.warnedContactIds = [];
            let mdJson = item.mdJson,
                lcc = item._lcc as LccIfc,
                logAdditions:LogAdditions = {
                    _item: item._id,
                    _lcc: item._lcc._id
                };
            // keyword isn't required but...
            if(!mdJson.metadata.resourceInfo.keyword) {
                this.log.warn(`[${SimplificationCodes.MISSING_KEYWORDS}][${item._id}]`,{...logAdditions,
                        code: SimplificationCodes.MISSING_KEYWORDS
                    });
            }

            const contacts = this.simplifyContacts(mdJson.contact.map(c => c.contactId),item);
            const responsibleParty = this.simplifyResponsibleParty(item,(mdJson.metadata.resourceInfo.citation.responsibleParty||[]));
            // collapse the coPrincipalInvestigator role into the principalInvestigator role
            // data managers use these inconsistently anyway.  Some times they will define a PI
            // some times multiple PIs (which would imply CO-PI) at any rate it appears they
            // just want PI and equate CO-PI to PI anyway so throw it away.
            if(responsibleParty.coPrincipalInvestigator) {
                responsibleParty.principalInvestigator = responsibleParty.principalInvestigator||[];
                const alreadyAPi = (contact) => responsibleParty.principalInvestigator.reduce((found,c) => found||(contact.contactId === c.contactId ? true : false),false);
                responsibleParty.coPrincipalInvestigator.forEach((cpi) => {
                    if(!alreadyAPi(cpi)) {
                        responsibleParty.principalInvestigator.push(cpi);
                    }
                });
                delete responsibleParty.coPrincipalInvestigator;
            }
            const keywords = (mdJson.metadata.resourceInfo.keyword||[]).reduce((map:SimplifiedKeywords,k):SimplifiedKeywords => {
                    if(k.keywordType) {
                        let typeLabel = k.keywordType,
                            typeKey = typeLabel
                                .trim()
                                .toLowerCase()
                                .replace(/[\.-]/g,'')
                                .replace(/\s+/g,'_');
                        if(EXCLUDED_KEYWORD_TYPES.indexOf(typeKey) === -1) {
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
                    }
                    return map;
                },{
                    types: [],
                    keywords: {},
                });

            item.simplified = {
                title: mdJson.metadata.resourceInfo.citation.title,
                lcc: lcc.title,
                lccs: [lcc.title], // will be updated later
                abstract: mdJson.metadata.resourceInfo.abstract,
                status: mdJson.metadata.resourceInfo.status.map(s => statusCamelToTitleCase(s)),
                keywords: keywords,
                contacts: contacts,
                leadOrgNames: (responsibleParty.principalInvestigator||[]).reduce((names,pi) => {
                        (pi.memberOfOrganization||[]).forEach(org => {
                            if(names.indexOf(org.name) === -1) {
                                names.push(org.name);
                            }
                        });
                        return names;
                    },[]),
                assocOrgNames: contacts.filter(c => c.isOrganization).map(o => o.name),
                responsibleParty: responsibleParty,
                resourceType: mdJson.metadata.resourceInfo.resourceType, // just copy over as is
                combinedResourceType: mdJson.metadata.resourceInfo.resourceType, // if project will be filled out with product resourceTypes later
                contactNames: contacts.map(c => c.name),
                allKeywords: Object.keys(keywords.keywords).reduce((all,keyType) => {
                        keywords.keywords[keyType].forEach(kw => {
                            if(all.indexOf(kw) === -1) {
                                all.push(kw);
                            }
                        });
                        return all;
                    },[]),
                onlineResources: mdJson.metadata.resourceInfo.citation.onlineResource,
                extent: this.simplifyExtent(item),
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

            return this.populateCollaboratingLccs(item)
                .then(() => this.updateAssociationsAndSave(item).then(resolve))
                .catch(reject);
        });
    }

    /**
     * Builds associations between an item and other items.  Products are just saved.
     * Projects are mined for related products and then those products are searched for.
     * If a project has products bi-directional relationships between the two are set and
     * all updated documents are saved.
     * 
     * @param item The item to save.
     */
    private updateAssociationsAndSave(item:ItemDoc):Promise<ItemDoc> {
        const logAdditions:LogAdditions = {
            _item: item._id,
            _lcc: item._lcc._id
        };
        // if simplifying a project go and relate it to any child products
        if(item.scType === ScType.PROJECT) {
            const productIds = FromScienceBase.findProductIds(item.mdJson);
            if(productIds.length) {
                return Item.find({_id:{$in:productIds}}).exec()
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
                                // duplicate fiscalYears of parent project onto child products for search/sort of product by fiscalYear
                                if(item.simplified.funding && item.simplified.funding.fiscalYears && item.simplified.funding.fiscalYears.length) {
                                    i.simplified.funding = i.simplified.funding||{}; // shouldn't exist.
                                    i.simplified.funding.fiscalYears = item.simplified.funding.fiscalYears;
                                }
                            });
                            item.simplified.combinedResourceType = combinedRt;
                            return Promise
                                .all(items.map(i => i.save()))
                                .then(() => item.save())
                        } else {
                            return item.save();
                        }
                    });
            }
        }
        return item.save();
    }

    /**
     * Generates a set of maps of all LCCs in the database.
     * `originals` is a map of `_id` to stored LCC title.
     * `normalized` is a map of normalized LCC names to `_id`
     */
    private lccMap():Promise<NormalizedLccInput> {
        return this.lccsPromise
            ? this.lccsPromise
            : (this.lccsPromise = Lcc.find({})
            .then(lccs => {
                const input:NormalizedLccInput = {
                    originals: lccs.reduce((map,lcc) => {
                            map[lcc._id.toString()] = lcc.title;
                            return map;
                        },{}),
                    normalized: lccs.reduce((map,lcc) => {
                            const idStr = lcc._id.toString();
                            Contacts.normalize(lcc.title).forEach(normal => map[normal] = idStr);
                            return map;
                        },{})
                }
                return input;
            }));
    }

    /**
     * Populates the `_lccs` property value with the `_id`s of LCCs that are found to be
     * "collaborators" on a given item.  The first value in `_lccs` is the `_id` of the 
     * owning LCC any other collaborators
     * @param item The item to set collaborating LCCs on.
     */
    private populateCollaboratingLccs(item:ItemDoc):Promise<void> {
        return this.lccMap()
            .then((input:NormalizedLccInput) => {
                const collaborators = item.simplified.responsibleParty.collaborator
                    ? item.simplified.responsibleParty.collaborator.filter(c => c.isOrganization && c.contactType === 'lcc' && !!c.name).map(c => Contacts.normalize(c.name))
                    : [];
                const ids:string[] = [item._lcc._id.toString()];
                if(collaborators.length) {
                    const normalizedMap = input.normalized;
                    // setup the list of collaborating LCC ids
                    collaborators.forEach(normalizedNames => {
                        normalizedNames.forEach(normalizedName => {
                            if(normalizedMap[normalizedName] && ids.indexOf(normalizedMap[normalizedName]) === -1) {
                                ids.push(normalizedMap[normalizedName]);
                            }
                        });
                    });
                }
                item._lccs = ids.map(id => new ObjectId(id));
                item.simplified.lccs = ids.map(id => input.originals[id]);
            });
    }

    /**
     * Builds a "responsible party" map given an array.  These types of maps are found
     * in a few places within `mdJson`.  Map keys are roles and values are arrays of
     * contacts.
     * 
     * @param item The item.
     * @param responsibleParty The responsible party array.
     */
    private simplifyResponsibleParty(item:ItemDoc,responsibleParty:any[]):SimplifiedContactsMap {
        return responsibleParty.reduce((map,poc) => {
                map[poc.role] = map[poc.role] || [];
                this.simplifyContacts(poc.party.map(ref => ref.contactId),item,poc)
                    .forEach(c => map[poc.role].push(c));
                return map;
            },{});
    }

    /**
     * Builds `simplified.dates`
     * 
     * @param item The item.
     */
    private simplifyDates(item:ItemDoc):SimplifiedDates {
        const mdJson = item.mdJson,
            timePeriod = mdJson.metadata.resourceInfo.timePeriod,
            logAdditions:LogAdditions = {
                _item: item._id,
                _lcc: item._lcc._id
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

    /**
     * Builds the value for `simplified.funding`
     * 
     * @param item The item.
     */
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
                _lcc: item._lcc._id
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
                        if(a.responsibleParty) {
                            alloc.responsibleParty = this.simplifyResponsibleParty(item,a.responsibleParty);
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

    /**
     * Builds `simplified.extent`
     * 
     * @param item The item.
     */
    private simplifyExtent(item:ItemDoc):SimplifiedExtent {
        try {
            const featureCollection = collectedFeatures(item.mdJson);
            if(featureCollection) {
                const bbox = geojsonExtent(featureCollection); // [WSEN]
                if(bbox && bbox.length === 4) {
                    const [w,s,e,n] = bbox;
                    // if a single point is fed in then we'll get back a bounding box
                    // that is a single point, if that happens then ignore the bbox (it's not a box)
                    const isPoint = w === e && s === n,
                          pointCoords = isPoint ?
                            [bbox[0],bbox[1]] :
                            [(w+(Math.abs(e-w)/2)),(s+(Math.abs(n-s)/2))];
                    return {
                        representativePoint: {
                            type: 'Point',
                            coordinates: pointCoords
                        },
                        boundingBox: !isPoint ? bbox : undefined
                    };
                }
            }
        } catch(geoError) {
            this.log.warn(`[${SimplificationCodes.GEOGRAPHIC_WARN}][${item._id}] "${geoError.message}"`,{
                    _lcc: item._lcc._id,
                    _item: item._id,
                    code: SimplificationCodes.GEOGRAPHIC_WARN,
                    data: this.constructErrorForStorage(geoError)
                });
        }
        return undefined;
    }

    /**
     * Translates a list of internal contact ids into simplified contact objects.
     * 
     * @param contactIds The list of ids (internal to `item.mdJson`)
     * @param item  The item.
     * @param context The optional context of contact simplification (for logging issues).
     */
    private simplifyContacts(contactIds:string[],item:ItemDoc,context?:any) {
        return contactIds
            .map(id => this.simplifyContact(id,item,context))
            .filter(c => !!c); // missing contacts happen
    }

    /**
     * Translates an internal contact id into a contact object.
     * 
     * @param contactId The internal contact id.
     * @param item The item.
     * @param context The optional context of contact simplification (for logging issues).
     */
    private simplifyContact(contactId:string,item:ItemDoc,context?:any):SimplifiedContact {
        if(context && context.contactId === contactId) {
            this.log.warn(`[${SimplificationCodes.MISSING_CONTACT}][${item._id}] "${contactId}"`,{
                _item: item._id,
                _lcc: item._lcc._id,
                code: SimplificationCodes.RECURSIVE_CONTACT,
                data: {
                    contacts: item.mdJson.contact,
                    context: context
                }
            });
            return null;
        }
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
            // missing contacts happen...
            let orgs = this.simplifyContacts(c.memberOfOrganization,item,c);
            if(orgs.length) {
                contact.memberOfOrganization = orgs;
            }
        }
        return contact;
    }

    /**
     * Tests for very basic equality between two contacts.
     * 
     * @param c1 The first contact.
     * @param c2 The second contact.
     */
    private equalContacts(c1:SimplifiedContact, c2:SimplifiedContact) {
        return c1.name === c2.name &&
            c1.positionName === c2.positionName &&
            c1.contactType === c2.contactType &&
            c1.isOrganization === c2.isOrganization;
        // not comparing electronicMailAddress or memberOfOrganization arrays
    }
}
