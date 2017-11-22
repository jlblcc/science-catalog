let mongoose = require('mongoose'),
    schema = require('./schema')(),
    Product = mongoose.model('Product',schema);

module.exports = Product;
