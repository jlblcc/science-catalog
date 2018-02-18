import { Schema, Document, model } from 'mongoose';
import { ObjectId } from 'mongodb';

/**
 * Schema for how errors are logged.
 */
export interface LogError {
    message: string;
    stack?: string;
}

export enum LogMessageType {
    INFO = 'info',
    ERROR = 'error',
    WARN = 'warn',
    DEBUG = 'debug'
};

/**
 * Exposes the SyncPipelineProcessorLog schema.
 */
export interface SyncPipelineProcessorLogIfc {
    /** The lcc id the message corresponds to */
    _lcc?: ObjectId | string;
    /** The item the message corresponds to */
    _item?: ObjectId | string;
    /** The type of log message */
    type: LogMessageType;
    /** The SyncPipelineProcessor id the message belongs to */
    processorId: string;
    /** The class name of the processor that issued the log message */
    processorClass?: string;
    /** When the message was logged */
    time: Date;
    /** The human readable log message */
    message: string;
    /** A SyncPipelineProcessor specific code (processors should document an enum) */
    code?: string;
    /** Associated data (if any) */
    data?: LogError | any;
}

/**
 * Unions SyncPipelineProcessorLogIfc with Mongoose Document.
 */
export interface SyncPipelineProcessorLogDoc extends SyncPipelineProcessorLogIfc, Document {}

const schema = new Schema({
    _lcc: {type: Schema.Types.ObjectId, ref: 'Lcc', required: false},
    _item: {type: Schema.Types.ObjectId, ref: 'Item', required: false},
    type: {type: String, required: true, enum:['info','error','warn','debug']},
    processorId: {type: String, required: true},
    processorClass: {type: String, required: false},
    time: {type: Date, required: true},
    message: {type: String, required: true},
    code: {type: String, required: false},
    data: {type: Schema.Types.Mixed, required: false}
},{
    capped: {
        size:(500*1024*1024) // 500Mb to start, not sure what's reasonable
        //max: <doc count>, autoIndexId: true
    }
});

/**
 * SyncPipelineProcessorLog model.  This collection holds log messages written
 * by SyncPipelineProcessors.  This collection is capped and so when it overflows
 * old messages will disappear.  Being capped has the advantage of allowing other
 * processes to dynamically watch for updates to this collection and receive them
 * ala `tail`.
 */
export const SyncPipelineProcessorLog = model<SyncPipelineProcessorLogDoc>('SyncPipelineProcessorLog',schema,'SyncPipelineProcessorLog');
