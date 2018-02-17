import { Schema, Document, model } from 'mongoose';
import { ObjectId } from 'mongodb';

/*
export interface SyncPipelineProcessorLogMessage extends Document {
    _lcc?: ObjectId;
    _item?: ObjectId;
    type: string;
    processorId: string;
    time: Date;
    message: string;
    code?: string;
}
*/

const schema = new Schema({
    _lcc: {type: Schema.Types.ObjectId, ref: 'Lcc', required: false},
    _item: {type: Schema.Types.ObjectId, ref: 'Item', required: false},
    type: {type: String, required: true, enum:['info','error','warn','debug']},
    processorId: {type: String, required: true},
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
 *
 * ### schema
 *
 * - _lcc: Id of the Lcc the message corresponds to (optional).
 * - _item: Id of the Item the message corresponds to (optional).
 * - type: The type of log message (one of `info`, `error`, `warn` or `debug`).
 * - processorId: The string id of the processor that saved the message.
 * - time: The instant the message was saved.
 * - message: The string log message.
 * - code: An opaque processor specific code (optional).
 */
export const SyncPipelineProcessorLog = model('SyncPipelineProcessorLog',schema,'SyncPipelineProcessorLog');
