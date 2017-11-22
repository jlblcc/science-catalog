let mongoose = require('mongoose'),
    schema = require('./schema')(),
    Project = mongoose.model('Project',schema);

module.exports = Project;
