let mongoose = require('mongoose'),
    schema = new mongoose.Schema({
        title: {type: String, required: true},
        lastSync: {type: Date, required: true},
    }),
    Lcc = mongoose.model('Lcc',schema);

module.exports = Lcc;
