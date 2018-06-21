import { Schema, model, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

import { LccnetRef, lccnetRefSchema } from './LccNetRef';

/**
 * Science catalog item types.
 */
export enum ScType {
   PROJECT = 'project',
   PRODUCT = 'product'
};

export interface StringToStringMap {
    [key: string]: any;
}
export interface StringToStringArrayMap {
    [key: string]: string[];
}

/**
 * Holds an individual mapping from type to label for a keyword type.
 */
export interface SimplifiedKeywordType {
    /** The keyword type (key into `SimplifiedKeywords.keywords`) */
    type: string;
    /** The keyword type label (the original `keywordType`) */
    label: string;
}

/**
 * Simplified keywords.  The `types` and `keywords` maps will have the same
 * set of keys.
 */
export interface SimplifiedKeywords {
    /** Map of keyword type key to keyword type label (original `keywordType`) */
    types: SimplifiedKeywordType[];
    /** Map of keyword type key to keyword values */
    keywords: StringToStringArrayMap;
}

const keywordsSchema = new Schema({
    types: [{ type: Schema.Types.Mixed, required: true}], // could be described
    // required is false because if there are no keywords that can be held onto
    // mongoose will strip the empty object, then a subsequent update will fail unless
    // all other code knows to put back an empty simplified.keywords.keywords object
    // which simply is not an option.
    keywords: { type: Schema.Types.Mixed, required: false }, // mongoose cannot validate but TypeScript can
},{
    _id : false,
    // if keywords are empty we still want the empty object persisted (doesn't seem to work)
    minimize: false
});

/**
 * The basic representation of a simplified contact.  Per the mdJson schema
 * At least one of `name` or `positionName` is required.
 *
 * @todo round this out, may expand for syncing into lccnetwork, etc.
 */
export interface SimplifiedContact {
    /** The original `contactId` as used in the `mdJson` **/
    contactId: string;
    /** The contact name */
    name?: string;
    /** The contact position */
    positionName?: string;
    /** The contactType property */
    contactType?: string;
    /** The isOrganization flag */
    isOrganization: boolean;
    /** The list of e-mail addresses */
    electronicMailAddress?: string[];
    /** The list of simplified organization contacts a contact is a member of */
    memberOfOrganization?: SimplifiedContact[];
    /** The contact's reference in lccnetwork (if any) */
    lccnet?: LccnetRef;
}
const contactSchema = new Schema({
    contactId: {type: String, required: true},
    name: {type: String, required: false},
    positionName: {type: String, required: false},
    contactType: {type: String, required: false},
    isOrganization: {type: Boolean, required: true},
    electronicMailAddress: [{type: String, required: false}],
    lccnet: {type: lccnetRefSchema, required: false},
},{_id: false});
// recursive here
contactSchema.add({
    memberOfOrganization: [{type: contactSchema, required: false}],
});

/**
 * Map of contact role to contact.
 */
export interface SimplifiedContactsMap {
    [role: string]: SimplifiedContact[];
}

/**
 * Definition of a resource type.
 */
export interface ResourceType {
    /** The resource type */
    type: string;
    /** An associated name (e.g. "Report on X") */
    name?: string;
}
const resourceTypeSchema = new Schema({
    type: { type: String, required: true },
    name: { type: String, required: false },
},{_id: false});


export interface SimplifiedFundingAllocation {
    /** The fiscal years of the allocation */
    fiscalYears?: number[];
    /** The allocation amount */
    amount: number;
    /** The allocation source */
    source?: SimplifiedContact;
    /** The allocation recipient */
    recipient?: SimplifiedContact;
    /** The award id */
    awardId?: string;
    /** contacts playing roles */
    responsibleParty?: SimplifiedContactsMap;
}
const fundingAllocationSchema = new Schema({
    fiscalYears: [{ type: Number, required: false }],
    amount: { type: Number, required: true },
    source: { type: contactSchema, required: false },
    recipient: { type: contactSchema, required: false },
    awardId: { type: String, required: false },
    // mongoose can't validate typescript can
    responsibleParty: { type: Schema.Types.Mixed, required: false },
},{_id: false});
export interface SimplifiedFundingAllocations {
    /** non-matching allocations */
    nonMatching?: SimplifiedFundingAllocation[];
    /** matching allocations */
    matching?: SimplifiedFundingAllocation[];
}
const fundingAllocationsSchema = new Schema({
    nonMatching: [{type:fundingAllocationSchema, required: false}],
    matching: [{type:fundingAllocationSchema, required: false}],
},{_id: false});

/**
 * Simplified/processed information about funding (built from `metadata.funding[]`).
 * https://mdtools.adiwg.org/#viewer-page?v=2-6
 * (Note: mongoose adds empty arrays for optional arrays)
 * 
 * Originally amount and matching were required BUT the LCC team wants to duplicate
 * a project's fiscalYears onto its child products.  Products don't otherwise have
 * any associated funding information and shouldn't have any.  For this reason everything
 * in this interface (and corresponding Mongoose model) is now optional.
 */
export interface SimplifiedFunding {
    /** The total funding (USD) */
    amount?: number;
    /** The list of fiscal years reported via funding (built from `funding[].timePeriod`) */
    fiscalYears?: number[];
    /** Any `sourceAllocationId` found (built from `funding[].allocation[].sourceAllocationId`) */
    awardIds?: string[];
    /** Whether any allocation has matching set to try */
    matching?: boolean;
    /** Funding source contacts */
    sources?: SimplifiedContact[];
    /** Funding recipient contacts */
    recipients?: SimplifiedContact[];
    /** Funding information re-organized by allocation/type */
    allocations?: SimplifiedFundingAllocations;
}
const fundingSchema = new Schema({
    amount: {type: Number, required: false},
    fiscalYears: [{type: Number, required: false}],
    awardIds: [{type: String, required: false}],
    matching: {type: Boolean, required: false},
    sources: [{type: contactSchema, required: false}],
    recipients: [{type: contactSchema, required: false}],
    allocations: {type: fundingAllocationsSchema, required: false},
},{_id: false});

/**
 * Simplified dates of interest.
 * @todo The keys here were built from a distinct query, perhaps it should just be open ended?
 */
export interface SimplifiedDates {
    sort?: Date;
    creation?: Date;
    lastUpdate?: Date;
    publication?: Date;
    end?: Date;
    start?: Date;
    lastRevision?: Date;
}
const datesSchema = new Schema({
    sort: {type: Date, required: false },
    creation: {type: Date, required: false },
    lastUpdate: {type: Date, required: false },
    publication: {type: Date, required: false },
    end: {type: Date, required: false },
    start: {type: Date, required: false },
    lastRevision: {type: Date, required: false },
},{_id: false});

/**
 * Basic GeoJson Geometry
 */
export interface Geometry {
    /** The geometry type (e.g. "Point", or "Polygon") */
    type: string;
    /** The lat/lng coordinates */
    coordinates: number[]|number[][];
}
const geometrySchema = new Schema({
    type: {type: String, required: true},
    // using mixed since most are number[][] but Point woud be number[]
    coordinates:[{type:Schema.Types.Mixed,required:true}]
},{_id: false});

export interface SimplifiedExtent {
    representativePoint: Geometry;
    boundingBox?: number[];
}
const extentSchema = new Schema({
    representativePoint: {type:geometrySchema, required:true},
    boundingBox:[{type:Number,required: false}]
},{_id: false});

export interface OnlineResource {
    uri: string;
    name?: string;
    protocol?: string;
    description?: string;
    function?: string;
}
const onlineResourceSchema = new Schema({
    uri: {type:String, required: true},
    name: {type:String, required: false},
    protocol: {type:String, required: false},
    description: {type:String, required: false},
    function: {type:String, required: false},
},{_id:false});
/**
 * The basic representation of a simplified item document.
 */
export interface SimplifiedIfc {
    /** The item title (`metadata.resourceInfo.citation.title`) */
    title: string;
    /** The title of the owning LCC */
    lcc: string;
    /** The titles of collaborating LCCs (owner first, like `_lcc` property) */
    lccs: string[];
    /** Dates of interest */
    dates?: SimplifiedDates;
    /** The item abstract (`metadata.resourceInfo.abstract`) */
    abstract: string;
    /** The item status array translated from camel to title case */
    status: string[];
    /** The item keywords (built from `metadata.resourceInfo.keyword`) */
    keywords: SimplifiedKeywords;
    /** The list of simplified contacts (built from `metadata.contact`) */
    contacts: SimplifiedContact[];
    /** List of Principal Investigator organization names (for search) */
    leadOrgNames: string[];
    /** List of all associated organization names (for search) */
    assocOrgNames: string[];
    /** The list of simplified contacts (built from `metadata.resourceInfo.citation.responsibleParty` and `metadata.contact`) */
    responsibleParty: SimplifiedContactsMap;
    /** The list of string resourceTypes (extracted from `metadata.resourceInfo.resourceType.type`) */
    resourceType: ResourceType[];
    /** The resourceType of this item combined with that of any of its children (projects will contain its product resource types in addition to its own) */
    combinedResourceType: ResourceType[];
    /** The simplified funding information */
    funding?: SimplifiedFunding;
    /** Just contact names (for text search) */
    contactNames: string[];
    /** All keyword values regardless of type (for text search and raw keyword search) */
    allKeywords: string[];
    /** Copy of `metadata.resourceInfo.citation.onlineResource` */
    onlineResources?: OnlineResource[];
    /** The geographic extent info if it can be generated */
    extent?: SimplifiedExtent;
    /** Reference to lccnetwork if one exists */
    lccnet?: LccnetRef;
}

/**
 * Exposes the Item schema.
 */
export interface ItemIfc {
    /** The sciencebase/catalog id */
    _id: any;
    /** Reference to the corresponding Lcc */
    _lcc: any;
    /**
     * Reference to any collaborating LCCs.
     * This list should always start with the `_lcc` reference and optionally include any others
     * that were found as contacts (`isOrganization && contactType === 'lcc'`).
     * The list will only be available after simplification.
     */
    _lccs: any[];
    /** The type of item */
    scType: ScType;
    /** The item's title */
    title: string;
    /** The SHA-1 hash of the contents of `mdJson` to determine when the source has changed */
    hash: string;
    /** The create timestamp */
    created: Date;
    /** The modified timestamp */
    modified: Date;
    /** The `mdJson` document */
    mdJson: any;
    /** The files field associatd with the item from sciencebase */
    files: any[];
    /** The simplified version of the `mdJson` document */
    simplified?: SimplifiedIfc;
    /** If scType is 'product' the parent project item */
    _project?: any;
    /** If scType is 'project' the child product items (if any) */
    _products?: any[];
}

/**
 * Unions ItemIfc with Mongoose Document.
 */
export interface ItemDoc extends ItemIfc, Document {}

const simplifiedSchema = new Schema({
    title: {type: String, required: true},
    lcc: {type: String, required: true},
    lccs: [{type: String, required: true}],
    dates: {type: datesSchema, required: false},
    abstract: {type: String, required: true },
    status: [{type:String, required: true}],
    keywords: keywordsSchema,
    contacts: [{type: contactSchema, required: true}],
    leadOrgNames: [{type: String, required: true}],
    assocOrgNames: [{type: String, required: true}],
    // mongoose cannot validate but TypeScript can
    responsibleParty: {type: Schema.Types.Mixed, required: false },
    resourceType: [resourceTypeSchema],
    combinedResourceType: [resourceTypeSchema],
    funding: { type: fundingSchema, required: false },
    contactNames: [{type: String, required: true}],
    allKeywords: [{type: String, required: true}],
    onlineResources: [{type:onlineResourceSchema,required: false}],
    extent: {type:extentSchema,required: false},
    lccnet: {type: lccnetRefSchema, required: false},
},{ _id : false });

const schema = new Schema({
        _lcc: {type: Schema.Types.ObjectId, ref: 'Lcc', required: true},
        _lccs: [{type: Schema.Types.ObjectId, ref: 'Lcc', required: false}],
        scType: {type: String, required: true, enum:['project','product']},
        title: {type: String, required: true},
        hash: {type: String, required: true},
        created: {type: Date, required: true},
        modified: {type: Date, required: true},
        mdJson: Schema.Types.Mixed,
        files: [Schema.Types.Mixed],
        simplified: simplifiedSchema,
        _project: {type: Schema.Types.ObjectId, ref: 'Item', required: false},
        _products: [{type: Schema.Types.ObjectId, ref: 'Item', required: false}],
    },{
        timestamps: {
            createdAt:'created',
            updatedAt:'modified'
        }
    });
schema.index({'simplified.abstract':'text','title':'text','simplified.contactNames':'text','simplified.allKeywords':'text'});
schema.index({'simplified.extent.representativePoint':'2dsphere'});
// one index per field the UI wants to sort on
schema.index({'simplified.dates.sort':1});
schema.index({'simplified.combinedResourceType':1});
schema.index({'simplified.title':1});
schema.index({'simplified.lcc':1});
schema.index({'simplified.responsibleParty.principalInvestigator.name':1});
schema.index({'simplified.funding.fiscalYears':1});
/**
 * Item model.
 */
export const Item = model<ItemDoc>('Item',schema,'Item');
