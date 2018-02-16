import { Schema, model } from 'mongoose';

/**
 * Item schema.
 *
 * - `_lcc`: Reference to the corresponding Lcc.
 * - scType: Science-catalog type.  Either `project` or `product`.
 * - title: The item title.
 * - hash: A SHA-1 hash of the contents of `mdJson` to determine when the source has changed.
 * - created : The create timestamp.
 * - modified: The modified timestamp.
 * - mdJson: The mdJson document.
 * - simplified: The simplified version of the mdJson document.
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
    },{
        timestamps: {
            createdAt:'created',
            updatedAt:'modified'
        }
    });

/**
 * The Item model
 */
export const Item = model('Item',schema,'Item');
