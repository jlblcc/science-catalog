import { Schema, model, Document } from 'mongoose';

import { LccnetRef, lccnetRefSchema } from './LccNetRef';

/**
 * Exposes the Contact schema
 */
export interface ContactIfc {
    name?: string;
    positionName?: string;
    isOrganization: boolean;
    electronicMailAddress?: string[];
    aliases?: string[];
    /** The list of LCC ids this contact is associated with */
    _lcc: any[];
    /** The list of Item ids this contact is associated with */
    _item: any[];
    /** The reference to the lccnetwork mastered object (if any) */
    lccnet?: LccnetRef;
}

/**
 * Unions ContactIfc with Mongoose Document.
 */
export interface ContactDoc extends ContactIfc, Document {}

const schema = new Schema({
    name: {type: String, required: false},
    positionName: {type: String, required: false},
    isOrganization: {type: Boolean, required: true},
    electronicMailAddress: [{type: String, required: false}],
    aliases: [{type: String, required: false, index: 1}],
    _lcc: [{type: Schema.Types.ObjectId, required: true, ref: 'Lcc'}],
    _item: [{type: Schema.Types.ObjectId, required: true, ref: 'Item'}],
    lccnet: {type: lccnetRefSchema, required: false},
});
schema.index({name:1,isOrganization:1});

/**
 * Contact model.
 */
export const Contact = model<ContactDoc>('Contact',schema,'Contact');
