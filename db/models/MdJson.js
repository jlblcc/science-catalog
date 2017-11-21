let mongoose = require('mongoose'),
    schema = new mongoose.Schema({ // intentionally vague to start
        _schema: mongoose.Schema.Types.Mixed,
        contact: [mongoose.Schema.Types.Mixed],
        metadataRepository: [mongoose.Schema.Types.Mixed],
        metadata: mongoose.Schema.Types.Mixed
    },{strict: false, collection: 'MdJson'});

let MdJson = mongoose.model('MdJson',schema);

module.exports = MdJson;
