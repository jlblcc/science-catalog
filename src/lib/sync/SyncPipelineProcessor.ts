import { EventEmitter } from 'events';
import { Logger } from '../log';
import { SyncPipelineProcessorEntry,
         SyncPipelineProcessorEntryIfc,
         SyncPipelineProcessorEntryDoc,
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
 * Base interface for a concrete SyncPipelineProcessor implementation.
 *
 * This forces a processor implementation to accurately document all of its
 * configuration options (if it has any).
 */
export interface SyncPipelineProcessorConfig {}

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
export abstract class SyncPipelineProcessor<T extends SyncPipelineProcessorConfig> extends EventEmitter {
    protected log:Logger;
    protected procEntry:SyncPipelineProcessorEntryDoc;
    protected results:SyncPipelineProcessorResults = {};
    protected config:T;

    /**
     * Constructs the new processor.
     *
     * @param processorId The processorId.
     */
    constructor(public processorId:string,config:any){
        super();
        this.log = new Logger(processorId);
        this.config = config as T;
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
            lastStart: new Date(),
            lastComplete: null
        },UPSERT_OPTIONS,(err,o) => {
            if(err) {
                return this.emit('error',err);
            }
            this.procEntry = o as SyncPipelineProcessorEntryDoc;
            const onSave = (err,o:SyncPipelineProcessorEntryDoc) => {
                if(err) {
                    return this.emit('error',err); // TODO not right type
                }
                let simple = simplifySyncPipelineEntryDocument(o);
                if(o.results && o.results.error) {
                    this.emit('error',simple);
                } else {
                    this.emit('complete',simple);
                }
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

    /**
     * Execute the logic for this processor.  Implementations must not
     * emit any events and must reject with an Error (or throw one).
     */
    protected abstract run():Promise<SyncPipelineProcessorResults>;
}
