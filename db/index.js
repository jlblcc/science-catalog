let debug = require('debug')('db'),
    mongoose = require('mongoose');

mongoose.Promise = Promise;

module.exports = function() {
   return new Promise((resolve,reject) => {
       if(mongoose.connection.readyState) {
            debug('Already connected to MongoDb');
            return resolve();
        }
       let host = 'localhost',
           port = 27017,
           db = 'science-catalog';
       mongoose.connect(`mongodb://${host}:${port}/${db}`,{useMongoClient:true})
        .then(resolve)
        .catch(reject);
   });
};
