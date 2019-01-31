import { Schema } from 'mongoose';

/**
 * A reference to an lccnetwork.org mastered object.
 * 
 * @todo It perhaps would have been nice to make this interface, and the names of the
 * properties that use it, more generic so that if a catalog were to be stood up
 * without being connected to lccnetwork.org these references would feel more broadly
 * applicable.  Technically they could be re-purposed as is but the coded names might
 * feel a little misleading.
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
