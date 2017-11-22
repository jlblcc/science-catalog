let mongoose = require('mongoose');

// project/product schema are idential
module.exports = function() {
    return new mongoose.Schema({
        title: {type: String, required: true},
        mdJson: mongoose.Schema.Types.Mixed,
    }/*,{strict: false}*/);
}
