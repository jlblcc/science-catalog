let mongoose = require('mongoose');

// project/product schema are idential
module.exports = function() {
    return new mongoose.Schema({
        _lcc: {type: mongoose.Schema.Types.ObjectId, ref: 'Lcc', required: true},
        title: {type: String, required: true},
        hash: {type: String, required: true},
        created: {type: Date, required: true},
        modified: {type: Date, required: true},
        mdJson: mongoose.Schema.Types.Mixed,
        simplified: mongoose.Schema.Types.Mixed
    }/*,{strict: false}*/);
};
