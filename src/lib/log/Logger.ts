import { ObjectId } from 'mongodb';
import { SyncPipelineProcessorLog } from '../../db/models';

/**
 * Optional additional logging properties.
 */
export interface LogAdditions {
     /** The _id of the Lcc that a message corresponds to. */
     _lcc?: ObjectId | string;
     /** The _id of the Item that a message corresponds to. */
     _item?: ObjectId | string;
     /** An opaque string that can be used during log analysis. */
     code?: string;
     /** Arbitrary data to be attached. */
     data?: any;
}

/**
 * Supports logging for SyncPipelineProcessors.  Messages may be logged via the
 * info, error, warn or debug functions.  Each of these functions accepts a
 * second optional parameter, `additional` of LogAdditions to store with the
 * log message.
 */
export class Logger {
    /**
     * Constructs a new Logger.  It is assumed that the process is already
     * connected to the database.
     *
     * @param processorId The `processorId` to set on all messages logged.
     * @param processorClass The class of the processor logging messages.
     */
    constructor(public processorId:string,public processorClass?:string) {
    }

    private _log(type:string,message:string,additional?:LogAdditions):Promise<void> {
        return new Promise((resolve,reject) => {
            let insert = Object.assign({},additional||{},{
                    type: type,
                    processorId: this.processorId,
                    processorClass: this.processorClass,
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
     * @param message The log message to store.
     * @param additional Additional properties to set on the log message.
     * @returns Resolved when message has been written to the log.
     */
    info(message:string,additional?:LogAdditions):Promise<void> {
        return this._log('info',message,additional);
    }

    /**
     * Log an error message
     *
     * @param message The log message to store.
     * @param additional Additional properties to set on the log message.
     * @returns Resolved when message has been written to the log.
     */
    error(message:string,additional?:LogAdditions):Promise<void> {
        return this._log('error',message,additional);
    }

    /**
     * Log an warn message
     *
     * @param message The log message to store.
     * @param additional Additional properties to set on the log message.
     * @returns Resolved when message has been written to the log.
     */
    warn(message:string,additional?:LogAdditions):Promise<void> {
        return this._log('warn',message,additional);
    }

    /**
     * Log an debug message
     *
     * @param message The log message to store.
     * @param additional Additional properties to set on the log message.
     * @returns Resolved when message has been written to the log.
     */
    debug(message:string,additional?:LogAdditions):Promise<void> {
        return this._log('debug',message,additional);
    }
}
