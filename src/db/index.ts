import * as mongoose from 'mongoose';
import * as dbg from 'debug';

const debug = dbg('db');

// use standard es6 promises
(<any>mongoose).Promise = Promise;

/**
 * Gathers mongo connection details from the environment (if any set).
 * 
 * The following environment variables are used:
 * - `MONGO_HOST` The host where mongo is running (default `localhost`).
 * - `MONGO_PORT` The port where mongo is listening (default `27017`).
 * - `MONGO_DB` The database to use (default `science-catalog`).
 * - `MONGO_USER` The user to use when connecting (default none).
 * - `MONGO_PASS` The password to use when connecting (default none).
 * 
 * Since the data is a read-only copy of data mastered in Science Base
 * requiring credentials feels like over-kill so by default neither user
 * or password have defaults.  Even if set their values will not be returned
 * in the resulting object but they will be built into the resulting url.
 * The `MONGO_DB` variable is mostly used to support using a separate database
 * for test purposes.
 */
function dbEnv() {
    const {
        MONGO_HOST,
        MONGO_PORT,
        MONGO_DB,
        MONGO_USER,
        MONGO_PASS
    } = process.env;
    const host = MONGO_HOST||'localhost';
    const port = parseInt(MONGO_PORT||'27017');
    const db = MONGO_DB||'science-catalog';
    const url = MONGO_USER && MONGO_PASS
        ? `mongodb://${MONGO_USER}:${encodeURIComponent(MONGO_PASS)}@${host}:${port}/${db}`
        : `mongodb://${host}:${port}/${db}`;
    debug(`Mongo URL "${url}"`);
    return {host,port,db,url};
}

/**
 * Establishes the database connection.
 * 
 * @see {@link dbEnv} for connection configuration.
 */
export function db():Promise<void> {
    if(mongoose.connection.readyState) {
            debug('Already connected to MongoDb');
            return Promise.resolve();
        }
    return mongoose.connect(dbEnv().url/*,{useNewUrlParser:true}*/)
        .then(() =>{}); // to satisfy <void> generic
};
