import { Schema, model, Document } from 'mongoose';
import { LogError } from './SyncPipelineProcessorLog';

/**
 * Exposes the SyncPipelineProcessorEntry schema.
 */
export interface SyncPipelineProcessorEntryIfc {
    /** The processorId */
    processorId: string;
    /** The last time the processor started a run */
    lastStart: Date;
    /** The last time the processor completed a run */
    lastComplete?: Date;
    /** The results of the last run (if any) */
    results?: any;
    /** The error from the last run (if any) */
    error?: LogError;
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
        error: o.error
    };
};

const schema = new Schema({
    processorId: {type: String, required: true},
    lastStart: {type: Date, required: true},
    lastComplete: {type: Date, required: false},
    results: Schema.Types.Mixed,
    error: Schema.Types.Mixed // could enforce schema here.
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
export const SyncPipelineProcessorEntry = model<SyncPipelineProcessorEntryDoc>('SyncPipelineProcessorEntry',schema,'SyncPipelineProcessorEntry');
