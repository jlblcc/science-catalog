let mongoose = require('mongoose');

// project/product schema are idential
module.exports = function() {
    return new mongoose.Schema({
        _lcc: {type: mongoose.Schema.Types.ObjectId, ref: 'Lcc', required: true},
        title: {type: String, required: true},
        mdJson: mongoose.Schema.Types.Mixed,
    }/*,{strict: false}*/);
};
