import { Schema, model, Document } from 'mongoose';
import { Item } from './Item';

/**
 * Exposes the Lcc schema
 */
export interface LccIfc {
    /** The sciencebase/catalog id */
    _id: any;
    /** The LCC title */
    title: string;
    /** The last time the LCC's items were synced */
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
 */
export const Lcc = model<LccDoc>('Lcc',schema,'Lcc');
