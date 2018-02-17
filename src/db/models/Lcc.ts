import { Schema, model, Document } from 'mongoose';
import { Item } from './Item';

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
// if an LCC is removed then remove any items that
// were synced for it.
schema.post('remove',(lcc:LccDoc) => {
    Item.remove({_lcc: lcc._id},(err) => {
        if(err) {
            console.error(err);
        }
    });
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
