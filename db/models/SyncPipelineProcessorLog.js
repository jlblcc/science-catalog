let mongoose = require('mongoose'),
    schema = new mongoose.Schema({
        _lcc: {type: mongoose.Schema.Types.ObjectId, ref: 'Lcc', required: false},
        _item: {type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: false},
        type: {type: String, required: true, enum:['info','error','warn','debug']},
        processorId: {type: String, required: true},
        time: {type: Date, required: true},
        message: {type: String, required: true},
        code: {type: String, required: false},
    },{
        capped: {
            size:(500*1024*1024) // 500Mb to start, not sure what's reasonable
            //max: <doc count>, autoIndexId: true
        }
    }),
    SyncPipelineProcessorLog = mongoose.model('SyncPipelineProcessorLog',schema);

module.exports = SyncPipelineProcessorLog;
