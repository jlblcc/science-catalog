import * as mongoose from 'mongoose';
import * as dbg from 'debug';

const debug = dbg('db');

// use standard es6 promises
(<any>mongoose).Promise = Promise;

/**
 * Database connection details.
 */
export interface DbConfig {
    /** The host to connect to (default "localhost") */
    host?:string;
    /** The port to connect to (default 27017) */
    port?:number;
    /** The db to connect to (default "science-catalog") */
    db?:string;
}

/**
 * Establishes the database connection.
 *
 * _Note_: You cannot pass DbConfiguration into the function because sync
 * pipeline processors are designed to be able to run in their own processes.
 * Allowing configuration per invocation would complicate that relationship.
 * This has the unfortunate side effect of having tests run in the main database
 * so they should clean up after themselves.
 *
 *
 * @todo Expand configurability
 * @todo Get defaults from a configuration file rather than hard coded so db() generates a default connection.
 */
export function db() {
    return new Promise((resolve,reject) => {
        if(mongoose.connection.readyState) {
             debug('Already connected to MongoDb');
             return resolve();
         }
        let cxConfig:DbConfig = {
            host: 'localhost',
            port: 27017,
            db: 'science-catalog'
        };
        debug('cxConfig',cxConfig);
        mongoose.connect(`mongodb://${cxConfig.host}:${cxConfig.port}/${cxConfig.db}`,{useMongoClient:true})
         .then(resolve)
         .catch(reject);
    });
};
