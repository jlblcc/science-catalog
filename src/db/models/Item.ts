import { Schema, model } from 'mongoose';

/**
 * Item schema.
 *
 * - `_lcc`: Reference to the corresponding Lcc
 */
const schema = new Schema({
        _lcc: {type: Schema.Types.ObjectId, ref: 'Lcc', required: true},
        scType: {type: String, required: true, enum:['project','product']},
        title: {type: String, required: true},
        hash: {type: String, required: true},
        created: {type: Date, required: true},
        modified: {type: Date, required: true},
        mdJson: Schema.Types.Mixed,
        simplified: Schema.Types.Mixed
    }/*,{strict: false}*/);

/**
 * The Item model
 */
export const Item = model('Item',schema);
