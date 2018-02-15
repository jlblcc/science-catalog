import { Schema, model } from 'mongoose';

const schema = new Schema({
    processorId: {type: String, required: true},
    lastStart: {type: Date, required: true},
    lastComplete: {type: Date, required: true},
    lastResults: Schema.Types.Mixed,
    data: Schema.Types.Mixed
});

export const SyncPipelineProcessor = model('SyncPipelineProcessor',schema);
