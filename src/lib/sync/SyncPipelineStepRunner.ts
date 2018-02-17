/**
 * Script to execute a sync pipeline step in its own process.  Takes a single
 * command-line argument which is the step configuration (as JSON).
 *
 * Basically does:
 * # deserializes the `SyncPipelineStep` from the command argument.
 * # resolves the `SyncPipelineProcessor` class.
 * # connects to the database
 * # sets up event handling to send messages back to the parent process
 * # starts the processor
 *
 * Exits with zero status upon succesful completion or one on error.
 */
import { db } from '../../db';
import { SyncPipelineStep } from './SyncPipelineManager';
import { SyncPipelineProcessor, SyncPipelineProcessorConfig, SyncPipelineProcessorResults } from './SyncPipelineProcessor';

let handleError = (err) => {
    process.send({
        key: 'error',
        data: {} // TODO
    });
    process.exit(1);
};

process.on('uncaughtException', handleError);

let step = JSON.parse(process.argv[2]) as SyncPipelineStep,
    ProcessorClass = require(step.module).default;

db().then(() => {
        let processor = new ProcessorClass(step.processorId,step.config) as SyncPipelineProcessor<SyncPipelineProcessorConfig,any>;
        processor.on('error',err => {
                process.send({
                    key: 'error',
                    data: err
                });
                process.exit(1);
            })
            .on('complete',results => {
                process.send({
                    key: 'complete',
                    data: results
                });
                process.exit(0);
            });
        processor.start();
    })
    .catch(err => handleError);
