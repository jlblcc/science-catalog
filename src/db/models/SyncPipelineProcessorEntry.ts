import { Schema, model, Document } from 'mongoose';

export interface SyncPipelineProcessorEntryIfc {
    processorId: string;
    lastStart: Date;
    lastComplete?: Date;
    results?: any;
    data?: any;
}

export interface SyncPipelineProcessorEntryDocumentIfc extends SyncPipelineProcessorEntryIfc,Document {
}

/**
 * Given a full fledged mongoose document returns a plain object.
 *
 * This exists so that for IPC a full fledged Mongoose document can be trimmed
 * down to a plain object and translated to/from JSON without any mongoose extras.
 *
 * This lives here to keep the translation close to its source for maintenance
 * reasons.
 */
export function simplifySyncPipelineEntryDocument(o:SyncPipelineProcessorEntryDocumentIfc):SyncPipelineProcessorEntryIfc {
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

export const SyncPipelineProcessorEntry = model('SyncPipelineProcessorEntry',schema,'SyncPipelineProcessorEntry');
