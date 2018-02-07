let mongoose = require('mongoose'),
    schema = new mongoose.Schema({
        _lcc: {type: mongoose.Schema.Types.ObjectId, ref: 'Lcc', required: true},
        scType: {type: String, required: true, enum:['project','product']},
        title: {type: String, required: true},
        hash: {type: String, required: true},
        created: {type: Date, required: true},
        modified: {type: Date, required: true},
        mdJson: mongoose.Schema.Types.Mixed,
        simplified: mongoose.Schema.Types.Mixed
    }/*,{strict: false}*/);
    Item = mongoose.model('Item',schema);

module.exports = Item;
