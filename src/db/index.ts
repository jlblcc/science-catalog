import * as mongoose from 'mongoose';
import * as dbg from 'debug';

const debug = dbg('db');

// use standard es6 promises
mongoose.Promise = Promise;

/**
 * Establishes the database connection.
 *
 * @todo Add configurability
 */
export function db() {
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
