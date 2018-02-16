import { db } from '../../db';
import { SyncPipelineStep } from './SyncPipelineManager';
import { SyncPipelineProcessor, SyncPipelineProcessorResults } from './SyncPipelineProcessor';

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
        let processor = new ProcessorClass(step.processorId,step.config) as SyncPipelineProcessor;
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
