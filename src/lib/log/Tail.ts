import { SyncPipelineProcessorLog } from '../../db/models';
import { QueryCursor } from 'mongoose';
import { EventEmitter } from 'events';

/**
 * Supports monitoring the sync pipeline processor log similar to the standard
 * `tail -f <file>` OS command.
 *
 * Instances of this class will emit `message` events as log messages arrive.
 *
 * A `Tail` must be started before it will begin emitting events.
 *
 * All tails will implicitly include criteria to filter out log messages that
 * arrived before the tail was started.
 */
export class Tail extends EventEmitter {
    private cursor:QueryCursor<any>;
    private criteria:any;

    /**
     * Constructs a new Tail.
     *
     * @param criteria Optional criteria to filter the log collection messages.
     */
    constructor(criteria) {
        super();
        this.criteria = Object.assign({},criteria||{},{time: {$gt: new Date()}});
    }

    /**
     * Starts the tail.
     *
     * @returns `this`
     */
    start():Tail {
        this.cursor = SyncPipelineProcessorLog
            .find(this.criteria)
            .tailable(true,{
                tailableRetryInterval: 500,
                //numberOfRetries: n
            }).cursor()
            .on('data',(message) => this.emit('message',message));
        return this;
    }

    /**
     * Stops the tail.
     *
     * @returns `this`
     */
    stop():Tail {
        if(this.cursor) {
            this.cursor.close();
        }
        return this;
    }
}
