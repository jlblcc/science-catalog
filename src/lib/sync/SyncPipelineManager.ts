import { SyncPipelineProcessor, SyncPipelineProcessorResults } from './SyncPipelineProcessor';
import { SyncPipelineProcessorEntryIfc } from '../../db/models';
import * as child_process from 'child_process';
import * as path from 'path';

/**
 * Defines a single step in the sync pipeline.
 */
export interface SyncPipelineStep {
    processorId: string;
    module: string;
    config?: any;
}

export class SyncPipelineManager {
    constructor(private pipeline:SyncPipelineStep[],private fork:boolean = false) {}

    run():Promise<SyncPipelineProcessorEntryIfc[]> {
        return new Promise((resolve,reject) => {
            this.pipeline.reverse(); // using pop
            let results:SyncPipelineProcessorEntryIfc[] = [],
                next = () => {
                    if(!this.pipeline.length) {
                        return resolve(results);
                    }
                    // run the next step
                    this.loadStep(this.pipeline.pop())
                        .on('complete',output => {
                            results.push(output);
                            next();
                        })
                        .on('error',err => {
                            reject(err);
                        }).start();
                };
            next();
        });
    }

    private loadStep(step:SyncPipelineStep):SyncPipelineProcessor {
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
class StepRunnerMonitor extends SyncPipelineProcessor {
    constructor(private step:SyncPipelineStep) {
        super(step.processorId,step.config);
    }

    /**
     * Override start and alter the behavior to run the step in a separate process.
     */
    start():void {
        const child = child_process.fork(`${__dirname}${path.sep}SyncPipelineStepRunner.js`,[JSON.stringify(this.step)]);
        // just pass along the child messages
        child.on('message',message => {
            if(message.key === 'complete') {
                // need to reconstitute dates from JSON transmitted via IPC
                if(message.data.lastStart) {
                    message.data.lastStart = new Date(message.data.lastStart);
                }
                if(message.data.lastComplete) {
                    message.data.lastComplete = new Date(message.data.lastComplete);
                }
            }
            this.emit(message.key,message.data)
        });
    }

    protected run():Promise<SyncPipelineProcessorResults> { return null;}
}
