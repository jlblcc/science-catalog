let mongoose = require('mongoose'),
    schema = new mongoose.Schema({
        processorId: {type: String, required: true},
        lastStart: {type: Date, required: true},
        lastComplete: {type: Date, required: true},
        lastResults: mongoose.Schema.Types.Mixed,
        data: mongoose.Schema.Types.Mixed
    }),
    SyncPipelineProcessor = mongoose.model('SyncPipelineProcessor',schema);

module.exports = SyncPipelineProcessor;
