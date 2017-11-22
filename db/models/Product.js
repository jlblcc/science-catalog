let mongoose = require('mongoose'),
    schema = require('./mdJsonContainer')(),
    Product = mongoose.model('Product',schema);

module.exports = Product;
