import { Schema, model, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

/**
 * Science catalog item types.
 */
export enum ScType {
   PROJECT = 'project',
   PRODUCT = 'product'
};

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
    simplified?: any;
}

/**
 * Unions ItemIfc with Mongoose Document.
 */
export interface ItemDoc extends ItemIfc, Document {}

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
 * Item model.
 */
export const Item = model<ItemDoc>('Item',schema,'Item');
