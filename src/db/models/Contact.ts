import { Schema, model, Document } from 'mongoose';

/**
 * Exposes the Contact schema
 */
export interface ContactIfc {
    name?: string;
    positionName?: string;
    contactType?: string;
    isOrganization: boolean;
    electronicMailAddress?: string;
    aliases?: string[];
}

/**
 * Unions ContactIfc with Mongoose Document.
 */
export interface ContactDoc extends ContactIfc, Document {}

const schema = new Schema({
    name: {type: String, required: false},
    positionName: {type: String, required: false},
    contactType: {type: String, required: false},
    isOrganization: {type: Boolean, required: true},
    electronicMailAddress: [{type: String, required: false}],
    aliases: [{type: String, required: false, index: 1}],
});
schema.index({name:1,isOrganization:1});

/**
 * Contact model.
 */
export const Contact = model<ContactDoc>('Contact',schema,'Contact');
