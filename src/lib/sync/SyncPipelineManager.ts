import { SyncPipelineProcessor, SyncPipelineProcessorConfig, SyncPipelineProcessorResults } from './SyncPipelineProcessor';
import { SyncPipelineProcessorEntryIfc } from '../../db/models';
import * as child_process from 'child_process';
import * as path from 'path';

import * as dbg from 'debug';

const debug = dbg('SyncPipelineManager');

/**
 * Defines a single step in the sync pipeline.
 */
export interface SyncPipelineStep {
    processorId: string;
    module: string;
    config?: any;
}

/**
 * Class responsible for managing the execution of the sync pipeline.  An instance
 * of this class simply loads and runs steps and passes along the results.
 */
export class SyncPipelineManager {
    /**
     * Construct a new SyncPipelineManager.
     *
     * @param pipeline The list of steps to be run.
     * @param fork Whether the steps should be run each in their own process.
     */
    constructor(private pipeline:SyncPipelineStep[],private fork:boolean = false) {}

    /**
     * The resulting promise will be resolved or rejected with a SyncPipelineProcessorEntryIfc[].
     * If resolved then all steps succeeded.  If rejected then the array will contain all
     * successful steps and the last element will be an error.  Its results object will contain
     * an `error` key containing the message and stack trace of what went wrong.
     */
    run():Promise<SyncPipelineProcessorEntryIfc[]> {
        return new Promise((resolve,reject) => {
            let steps = this.pipeline
                .slice(0) // don't be destructive
                .reverse() // using pop
            let results:SyncPipelineProcessorEntryIfc[] = [],
                next = () => {
                    if(!steps.length) {
                        return resolve(results);
                    }
                    // run the next step
                    this.loadStep(steps.pop())
                        .on('complete',output => {
                            results.push(output);
                            next();
                        })
                        .on('error',err => {
                            results.push(err);
                            reject(results);
                        }).start();
                };
            next();
        });
    }

    /**
     * Loads an individual step's SyncPipelineProcessor.  If this manager
     * was instantiated with the fork flag set to true then the processor that
     * returns will run in a forked child process, not in this one.
     *
     * @param step The step to instantiate.
     * @returns The processor.
     */
    private loadStep(step:SyncPipelineStep):SyncPipelineProcessor<SyncPipelineProcessorConfig,any> {
        if(this.fork) {
            return new StepRunnerMonitor(step);
        }
        // run in this process
        let ProcessorClass = require(step.module).default;
        return new ProcessorClass(step.processorId,step.config);
    }
}

/**
 * A SyncPipelineProcessor that runs the underlying step in a separate
 * process.
 */
class StepRunnerMonitor extends SyncPipelineProcessor<SyncPipelineProcessorConfig,any> {
    /**
     * Instantiate a new StepRunnerMonitor to execute a pipeline step in
     * its own process.  Externally this instance will behave identically
     * to the underlying step it runs when invoking `start`.
     *
     * @param step The step to run in a child process on start.
     */
    constructor(private step:SyncPipelineStep) {
        super(step.processorId,step.config);
    }

    /**
     * Override start and alter the behavior to run the step in a separate process.
     */
    start():void {
        debug(`forking ${__dirname}${path.sep}SyncPipelineStepRunner.js with`,this.step);
        const child = child_process.fork(`${__dirname}${path.sep}SyncPipelineStepRunner.js`,[JSON.stringify(this.step)]);
        // just pass along the child messages
        child.on('message',message => {
            // need to reconstitute dates from JSON transmitted via IPC
            if(message.data.lastStart) {
                message.data.lastStart = new Date(message.data.lastStart);
            }
            if(message.data.lastComplete) {
                message.data.lastComplete = new Date(message.data.lastComplete);
            }
            this.emit(message.key,message.data)
        });
    }

    /** Not used in this implementation */
    protected run():Promise<SyncPipelineProcessorResults<any>> { return null;}
}
