import { Schema, model, Document } from 'mongoose';

/**
 * Exposes the SyncPipelineProcessorEntry schema
 */
export interface SyncPipelineProcessorEntryIfc {
    processorId: string;
    lastStart: Date;
    lastComplete?: Date;
    results?: any;
    data?: any;
}

/**
 * Unions SyncPipelineProcessorEntryIfc with Mongoose Document.
 */
export interface SyncPipelineProcessorEntryDoc extends SyncPipelineProcessorEntryIfc,Document {}

/**
 * Given a full fledged mongoose document returns a plain object.
 *
 * This exists so that for IPC a full fledged Mongoose document can be trimmed
 * down to a plain object and translated to/from JSON without any mongoose extras.
 *
 * This lives here to keep the translation close to its source for maintenance
 * reasons.
 */
export function simplifySyncPipelineEntryDocument(o:SyncPipelineProcessorEntryDoc):SyncPipelineProcessorEntryIfc {
    return {
        processorId: o.processorId,
        lastStart: o.lastStart,
        lastComplete: o.lastComplete,
        results: o.results,
        data: o.data
    };
};

const schema = new Schema({
    processorId: {type: String, required: true},
    lastStart: {type: Date, required: true},
    lastComplete: {type: Date, required: false},
    results: Schema.Types.Mixed,
    data: Schema.Types.Mixed
});

/**
 * SyncPipelineProcessorEntry model
 *
 * #### Schema
 *
 * - processorId: The id of the processor.
 * - lastStart: The last time the processor began a run.
 * - lastComplete: The last time the processor completed a run.
 * - results: The results of the last run.
 * - data: Any auxiliary data from the last run.
 *
 * @todo consider whether both results and data are necessary and/or how they might be strongly typed.
 */
export const SyncPipelineProcessorEntry = model('SyncPipelineProcessorEntry',schema,'SyncPipelineProcessorEntry');
