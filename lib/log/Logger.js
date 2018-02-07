const SyncPipelineProcessorLog = require('../../db/models/SyncPipelineProcessorLog');

/**
 * Additional logging properties.
 * @typedef {Object} LogAdditions
 * @property {ObjectId | string} _lcc The _id of the Lcc that a message corresponds to.
 * @property {ObjectId | string} _item The _id of the Item that a message corresponds to.
 * @property {string} code An opaque string that can be used during log analysis.
 */

/**
 * <p>Supports logging for SyncPipelineProcessors.  Messages may be logged via the
 * [info]{@link Logger#info}, [error]{@link Logger#error}, [warn]{@link Logger#warn}
 * or [debug]{@link Logger#debug} functions.  Each of these functions accepts a
 * second optional parameter, <code>additional</code>.  This parameter must be an object
 * and may contain the following list of acceptable properties see {@link LogAdditions}.</p>
 */
class Logger {
    /**
     * Constructs a new Logger.  It is assumed that the process is already
     * connected to the database.
     *
     * @param {!string} processorId The <code>processorId</code> to set on all messages logged.
     */
    constructor(processorId) {
        this.processorId = processorId;
    }

    _log(type,message,additional) {
        return new Promise((resolve,reject) => {
            let insert = Object.assign({},additional||{},{
                    type: type,
                    processorId: this.processorId,
                    message:message,
                    time: new Date()
                }),
                line = new SyncPipelineProcessorLog(insert);
            line.save((err) => {
                if(err) {
                    return reject(err);
                }
                resolve();
            });
        });

    }

    /**
     * Log an info message
     *
     * @param {string} message The log message to store.
     * @param {?LogAdditions} additional Additional properties to set on the log message.
     * @returns {Promise} Resolved when message has been written to the log.
     */
    info(message,additional) {
        return this._log('info',message,additional);
    }

    /**
     * Log an error message
     *
     * @param {string} message The log message to store.
     * @param {?LogAdditions} additional Additional properties to set on the log message.
     * @returns {Promise} Resolved when message has been written to the log.
     */
    error(message,additional) {
        return this._log('error',message,additional);
    }

    /**
     * Log an warn message
     *
     * @param {string} message The log message to store.
     * @param {?LogAdditions} additional Additional properties to set on the log message.
     * @returns {Promise} Resolved when message has been written to the log.
     */
    warn(message,additional) {
        return this._log('warn',message,additional);
    }

    /**
     * Log an debug message
     *
     * @param {string} message The log message to store.
     * @param {?LogAdditions} additional Additional properties to set on the log message.
     * @returns {Promise} Resolved when message has been written to the log.
     */
    debug(message,additional) {
        return this._log('debug',message,additional);
    }
}

module.exports = Logger;
