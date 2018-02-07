/**
 * @module lib/log
 */
const Logger = require('./Logger');
const Tail = require('./Tail');

/**
 * Exposes access to basic logging related classes.
 */
module.exports = {
    /**
     * Creates a new {@link Logger}
     * @param {!string} processorId The <code>processorId</code> for the new <code>Logger</code>.
     * @returns {Logger} The new logger instance.
     */
    newLogger: function(processorId) {
        return new Logger(processorId);
    },
    /**
     * Creates a new {@link Tail}.  The Tail will not have been started.
     *
     * @param {?Object} criteria The criteria to filter log messages by.
     * @returns {Tail} The new Tail object.
     */
    tail: function(criteria) {
        return new Tail(criteria);
    }
}
