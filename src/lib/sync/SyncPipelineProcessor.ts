import { EventEmitter } from 'events';
import { Logger } from '../log';
import { SyncPipelineProcessorEntry,
         SyncPipelineProcessorEntryIfc,
         SyncPipelineProcessorEntryDoc,
         simplifySyncPipelineEntryDocument,
         LogError } from '../../db/models';

const UPSERT_OPTIONS = {
    upsert: true,
    new: true
};

/**
 * The succesful output of a SyncPipelineProcessor's run invocation (Promise resolve).
 *
 * @todo refine, can't at the moment recall what the plans were for results but it should be strongly typed.
 */
export interface SyncPipelineProcessorResults<R> {
    results?: R;
    error?: LogError;
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
 * The `C` generic type defines the configuration the processor accepts.
 * The `R` generic type defines what the processor produces for the results property on a succesful run.
 */
export abstract class SyncPipelineProcessor<C extends SyncPipelineProcessorConfig,R> extends EventEmitter {
    protected log:Logger;
    protected processorClass:string;
    protected procEntry:SyncPipelineProcessorEntryDoc;
    protected results:SyncPipelineProcessorResults<R> = {};
    protected config:C;

    /**
     * Constructs the new processor.
     *
     * @param processorId The processorId.
     */
    constructor(public processorId:string,config:any){
        super();
        this.processorClass = this.constructor.name;
        this.log = new Logger(processorId,this.processorClass);
        this.config = config as C;
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
            processorClass: this.processorClass,
            lastStart: new Date()
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
                if(o.error) {
                    this.emit('error',simple);
                } else {
                    this.emit('complete',simple);
                }
            };
            this.run()
                .then(output => {
                    this.procEntry.lastComplete = new Date();
                    this.procEntry.error = null;
                    this.procEntry.results = output.results;
                    this.procEntry.save(onSave);
                }).catch((err:Error) => {
                    this.procEntry.lastComplete = new Date();
                    this.procEntry.results = null;
                    this.procEntry.error = this.constructErrorForStorage(err);
                    this.procEntry.save(onSave);
                });
        });
    }

    protected constructErrorForStorage(err) {
        if(err && (err.message || err.stack)) {
            return {
                message: err.message,
                stack: err.stack,
            };
        }
        return {
            message: 'Unexpected error'
        };
    }

    /**
     * Execute the logic for this processor.  Implementations must not
     * emit any events and must reject with an Error (or throw one).
     */
    protected abstract run():Promise<SyncPipelineProcessorResults<R>>;
}
