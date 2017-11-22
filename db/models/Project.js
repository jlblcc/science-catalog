let mongoose = require('mongoose'),
    schema = require('./mdJsonContainer')(),
    Project = mongoose.model('Project',schema);

module.exports = Project;
