import { Schema, model, Document } from 'mongoose';

/**
 * Exposes the Lcc schema
 */
export interface LccIfc {
    title: string;
    lastSync?: Date;
}

/**
 * Unions LccIfc with Mongoose Document.
 */
export interface LccDoc extends LccIfc, Document {}

const schema = new Schema({
    title: {type: String, required: true},
    lastSync: {type: Date, required: false},
});

/**
 * LCC model.
 *
 * #### Schema
 *
 * - title: The name of the LCC.
 * - lastSync: The last time a sync for this LCC was performed.
 */
export const Lcc = model<LccDoc>('Lcc',schema,'Lcc');
