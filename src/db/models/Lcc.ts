import { Schema, model, Document } from 'mongoose';
import { Item } from './Item';

import { LccnetRef, lccnetRefSchema } from './LccNetRef';

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
    /** The reference to the corresponding lccnetwork object. */
    lccnet: LccnetRef;
}

/**
 * Unions LccIfc with Mongoose Document.
 */
export interface LccDoc extends LccIfc, Document {}

const schema = new Schema({
    title: {type: String, required: true},
    lastSync: {type: Date, required: false},
    lccnet: {type: lccnetRefSchema, required: true},
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
