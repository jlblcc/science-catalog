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
 * Simplified keywords.  The `types` and `keywords` maps will have the same
 * set of keys.
 */
export interface SimplifiedKeywords {
    /** Map of keyword type key to keyword type label (original `keywordType`) */
    types: StringToStringMap;
    /** Map of keyword type key to keyword values */
    keywords: StringToStringArrayMap;
}

/**
 * The basic representation of a simplified contact.  Per the mdJson schema
 * At least one of `name` or `positionName` is required.
 *
 * @todo round this out, may expand for syncing into lccnetwork, etc.
 */
export interface SimplifiedContact {
    /** The contact name */
    name?: string;
    /** The contact position */
    positionName?: string;
    /** The isOrganization flag */
    isOrganization: boolean;
    /** The list of e-mail addresses */
    electronicMailAddress?: string[];
    memberOfOrganization?: SimplifiedContact[];
}

export interface SimplifiedContacts {
    [role: string]: SimplifiedContact[];
}

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
    /** The list of simplified contacts (built from `metadata.resourceInfo.pointOfContact` and `metadata.contact`) */
    contacts: SimplifiedContacts;
    /** The list of fiscal years reported via funding (built from `mdJson.metadata.funding.timePeriod`) */
    fiscalYears: number[];
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

// mongoose cannot validate but TypeScript can
const keywordsSchema= new Schema({
    types: { type: Schema.Types.Mixed, required: true},
    keywords: { type: Schema.Types.Mixed, required: true },
},{ _id : false });

const simplifiedSchema = new Schema({
    title: {type: String, required: true},
    lcc: {type: String, required: true},
    abstract: {type: String, required: true },
    keywords: keywordsSchema,
    // mongoose cannot validate but TypeScript can
    contacts: {type: Schema.Types.Mixed, required: true },
    fiscalYears: [{type: Number, required: true}],
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
