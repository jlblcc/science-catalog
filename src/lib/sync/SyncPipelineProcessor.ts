import { EventEmitter } from 'events';
import { Logger } from '../log';
import { SyncPipelineProcessorEntry,
         SyncPipelineProcessorEntryIfc,
         SyncPipelineProcessorEntryDocumentIfc,
         simplifySyncPipelineEntryDocument } from '../../db/models';

const UPSERT_OPTIONS = {
    upsert: true,
    new: true
};

/**
 * The succesful output of a SyncPipelineProcessor's run invocation (Promise resolve).
 *
 * @todo refine, can't at the moment recall what the plans were for results but it should be strongly typed.
 */
export interface SyncPipelineProcessorResults {
    results?: any;
    data?: any;
}

/**
 * The base class for a SyncPipelineProcessor implementation.
 *
 * Emits the following events.
 * - `error` When an error occurs with the error as the payload.
 * - `complete` When the processor run has completed will emit an instance of `SyncPipelineProcessorEntryIfc`.
 *
 * Concrete sub-classes must implement the `run` function.  They must __not__
 * emit either any events.  If the run promise needs to be rejected it __must__
 * be with an instance of `Error`.
 *
 * @todo what's the best complete payload?
 */
export abstract class SyncPipelineProcessor extends EventEmitter {
    protected log:Logger;
    protected procEntry:SyncPipelineProcessorEntryDocumentIfc;

    /**
     * Constructs the new processor.
     *
     * @param processorId The processorId.
     */
    constructor(public processorId:string,protected config:any){
        super();
        this.log = new Logger(processorId);
    }

    /**
     * Starts the processor.  Will emit `error` if something goes wrong
     * and will emit `complete` with an instance of `SyncPipelineProcessorEntryIfc`.
     */
    start():void {
        SyncPipelineProcessorEntry.findOneAndUpdate({
            processorId: this.processorId
        },{
            processorId: this.processorId,
            lastStart: new Date()
        },UPSERT_OPTIONS,(err,o) => {
            if(err) {
                return this.emit('error',err);
            }
            this.procEntry = o as SyncPipelineProcessorEntryDocumentIfc;
            const onSave = (err,o:SyncPipelineProcessorEntryDocumentIfc) => {
                if(err) {
                    return this.emit('error',err); // TODO not right type
                }
                this.emit('complete',simplifySyncPipelineEntryDocument(o));
            };
            this.run()
                .then(output => {
                    this.procEntry.lastComplete = new Date();
                    this.procEntry.results = output.results;
                    this.procEntry.data = output.data;
                    this.procEntry.save(onSave);
                }).catch((err:Error) => {
                    this.procEntry.lastComplete = new Date();
                    this.procEntry.data = null;
                    this.procEntry.results = {
                        error: {
                            message: err.message,
                            stack: err.stack
                        }
                    };
                    this.procEntry.save(onSave);
                });
        });
    }

    protected abstract run():Promise<SyncPipelineProcessorResults>;
}
