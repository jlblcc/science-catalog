const SyncPipelineProcessorLog = require('../../db/models/SyncPipelineProcessorLog');
const EventEmitter = require('events');

/**
 * <p>Supports monitoring the sync pipeline processor log similar to the standard
 * <code>tail -f &lt;file&gt;</code> OS command.</p>
 *
 * <p>Instances of this class will emit <code>message</code> events as log
 * messages arrive</p>
 *
 * <p>A <code>Tail</code> must be started before it will begin emitting events.</p>
 *
 * <p>All tails will implicitly include criteria to filter out log messages that
 * arrived before the tail was started.</p>
 */
class Tail extends EventEmitter {
    /**
     * Constructs a new Tail.
     *
     * @param {?Object} criteria Optional criteria to filter the log collection messages.
     */
    constructor(criteria) {
        super();
        this.criteria = Object.assign({},criteria||{},{time: {$gt: new Date()}});
    }
    /**
     * Starts the tail.
     *
     * @returns {Tail} this.
     */
    start() {
        SyncPipelineProcessorLog.find(this.criteria)
            .tailable().cursor()
            .on('data',(message) => this.emit('message',message));
        return this;
    }
}

module.exports = Tail;
