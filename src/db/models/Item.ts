import { Schema, model, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

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
// mongoose cannot validate but TypeScript can
const keywordsSchema= new Schema({
    types: { type: Schema.Types.Mixed, required: true},
    keywords: { type: Schema.Types.Mixed, required: true },
},{ _id : false });

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
}
const contactSchema = new Schema({
    contactId: {type: String, required: true},
    name: {type: String, required: false},
    positionName: {type: String, required: false},
    contactType: {type: String, required: false},
    isOrganization: {type: Boolean, required: true},
    electronicMailAddress: [{type: String, required: false}],
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

/**
 * Simplified/processed information about funding (built from `metadata.funding[]`).
 * https://mdtools.adiwg.org/#viewer-page?v=2-6
 * (Note: mongoose adds empty arrays for optional arrays)
 */
export interface SimplifiedFunding {
    /** The total funding (USD) */
    amount: number;
    /** The list of fiscal years reported via funding (built from `funding[].timePeriod`) */
    fiscalYears?: number[];
    /** Any `sourceAllocationId` found (built from `funding[].allocation[].sourceAllocationId`) */
    awardIds?: string[];
    /** Whether any allocation has matching set to try */
    matching: boolean;
    /** Funding source contacts */
    sources?: SimplifiedContact[];
    /** Funding recipient contacts */
    recipients?: SimplifiedContact[];
}
const fundingSchema = new Schema({
    amount: {type: Number, required: true},
    fiscalYears: [{type: Number, required: false}],
    awardIds: [{type: String, required: false}],
    matching: {type: Boolean, required: true},
    sources: [{type: contactSchema, required: false}],
    recipients: [{type: contactSchema, required: false}],
},{_id: false});

/**
 * The basic representation of a simplified item document.
 */
export interface SimplifiedIfc {
    /** The item title (`metadata.resourceInfo.citation.title`) */
    title: string;
    /** The title of the owning LCC */
    lcc: string;
    /** The item abstract (`metadata.resourceInfo.abstract`) */
    abstract: string;
    /** The item keywords (built from `metadata.resourceInfo.keyword`) */
    keywords: SimplifiedKeywords;
    /** The list of simplified contacts (built from `metadata.contact`) */
    contacts: SimplifiedContact[];
    /** The list of simplified contacts (built from `metadata.resourceInfo.pointOfContact` and `metadata.contact`) */
    pointOfContact: SimplifiedContactsMap;
    /** The list of string resourceTypes (extracted from `metadata.resourceInfo.resourceType.type`) */
    resourceType: ResourceType[];
    /** The simplified funding information */
    funding?: SimplifiedFunding;
}

/**
 * Exposes the Item schema.
 */
export interface ItemIfc {
    /** The sciencebase/catalog id */
    _id: any;
    /** Reference to the corresponding Lcc */
    _lcc: any;
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
    /** The simplified version of the `mdJson` document */
    simplified?: SimplifiedIfc;
}

/**
 * Unions ItemIfc with Mongoose Document.
 */
export interface ItemDoc extends ItemIfc, Document {}

const simplifiedSchema = new Schema({
    title: {type: String, required: true},
    lcc: {type: String, required: true},
    abstract: {type: String, required: true },
    keywords: keywordsSchema,
    contacts: [{type: contactSchema, required: true}],
    // mongoose cannot validate but TypeScript can
    pointOfContact: {type: Schema.Types.Mixed, required: true },
    resourceType: [resourceTypeSchema],
    funding: { type: fundingSchema, required: false },
},{ _id : false });

const schema = new Schema({
        _lcc: {type: Schema.Types.ObjectId, ref: 'Lcc', required: true},
        scType: {type: String, required: true, enum:['project','product']},
        title: {type: String, required: true},
        hash: {type: String, required: true},
        created: {type: Date, required: true},
        modified: {type: Date, required: true},
        mdJson: Schema.Types.Mixed,
        simplified: simplifiedSchema,
    },{
        timestamps: {
            createdAt:'created',
            updatedAt:'modified'
        }
    });

/**
 * Item model.
 */
export const Item = model<ItemDoc>('Item',schema,'Item');
