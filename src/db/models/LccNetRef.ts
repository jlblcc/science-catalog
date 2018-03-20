import { Schema } from 'mongoose';

/**
 * A reference to an lccnetwork.org mastered object.
 */
export interface LccnetRef {
    id: number;
    url: string;
}

/**
 * The mongoose schema for LccnetRef
 */
export const lccnetRefSchema = new Schema({
    id: {type: Number, required: true},
    url: {type: String, required: true},
},{_id: false});
