import { Schema, model } from 'mongoose';

/**
 * LCC schema.
 *
 * - title: The name of the LCC.
 * - lastSync: The last time a sync for this LCC was performed.
 */
const schema = new Schema({
    title: {type: String, required: true},
    lastSync: {type: Date, required: false},
});

export const Lcc = model('Lcc',schema,'Lcc');
