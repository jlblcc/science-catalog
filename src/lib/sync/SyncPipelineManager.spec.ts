/**
 * Basic tests fo the SyncPipelineManager executing pipelines
 */
import { db } from '../../db';
import { SyncPipelineProcessorEntry, SyncPipelineProcessorEntryIfc } from '../../db/models';
import { SyncPipelineManager, SyncPipelineStep } from './SyncPipelineManager';
import * as mongoose from 'mongoose';
import { expect } from 'chai';

const rethrow = err => {
    console.error('RETHROWING',err);
    throw err; };

describe('SyncPipelineManager',() => {
    // all tests require a connection
    before(() => db());

    after(() => SyncPipelineProcessorEntry.remove({processorClass:'TestProcessor'})
                    .then(() => mongoose.disconnect()));

    it('simple pipeline (in-process)',() => {
        let steps:SyncPipelineStep[] = [{
            processorId: 'simple',
            module: './processors/TestProcessor',
            config: {
                results: 'simple one step'
            }
        }];
        return (new SyncPipelineManager(steps)).run()
            .then(results => {
                expect(results).to.be.instanceof(Array).with.length(1);
                let result = results[0];
                expect(result).to.be.instanceof(Object);
                expect(result.processorId).to.equal(steps[0].processorId);
                expect(result.lastStart).to.be.instanceof(Date);
                expect(result.lastComplete).to.be.instanceof(Date);
                expect(result.error).to.equal(null);
                expect(result.results).to.equal(steps[0].config.results);
            }).catch(rethrow);
    });

    it('multistep pipeline (in-process)',() => {
        let steps:SyncPipelineStep[] = [{
            processorId: 'simple',
            module: './processors/TestProcessor',
            config: {
                results: 'simple one step'
            }
        },{
            processorId: 'simple2',
            module: './processors/TestProcessor',
            config: {
                results: 'step 2 results'
            }
        }];
        return (new SyncPipelineManager(steps)).run()
            .then(results => {
                expect(results).to.be.instanceof(Array).with.length(2);
                let result = results[0];
                expect(result).to.be.instanceof(Object);
                expect(result.processorId).to.equal(steps[0].processorId);
                expect(result.lastStart).to.be.instanceof(Date);
                expect(result.lastComplete).to.be.instanceof(Date);
                expect(result.error).to.equal(null);
                expect(result.results).to.equal(steps[0].config.results);
                result = results[1];
                expect(result).to.be.instanceof(Object);
                expect(result.processorId).to.equal(steps[1].processorId);
                expect(result.lastStart).to.be.instanceof(Date);
                expect(result.lastComplete).to.be.instanceof(Date);
                expect(result.error).to.equal(null);
                expect(result.results).to.equal(steps[1].config.results);
            }).catch(rethrow);
    });

    it('simple pipeline (forked)',() => {
        let steps:SyncPipelineStep[] = [{
            processorId: 'simple',
            module: './processors/TestProcessor',
            config: {
                results: 'simple result'
            }
        }];
        return (new SyncPipelineManager(steps,true)).run()
            .then(results => {
                expect(results).to.be.instanceof(Array).with.length(1);
                let result = results[0];
                expect(result).to.be.instanceof(Object);
                expect(result.processorId).to.equal(steps[0].processorId);
                expect(result.lastStart).to.be.instanceof(Date);
                expect(result.lastComplete).to.be.instanceof(Date);
                expect(result.error).to.equal(null);
                expect(result.results).to.equal(steps[0].config.results);
            }).catch(rethrow);
    });

    it('simple pipeline (error)',() => {
        let steps:SyncPipelineStep[] = [{
            processorId: 'simple',
            module: './processors/TestProcessor',
            config: {
                error: 'simple error'
            }
        }];
        return (new SyncPipelineManager(steps)).run()
            .then(results => {
                throw Error('should not succeed.');
            })
            .catch(results => {
                expect(results).to.be.instanceof(Array).with.length(1);
                let result = results[0];
                expect(result).to.be.instanceof(Object);
                expect(result.processorId).to.equal(steps[0].processorId);
                expect(result.lastStart).to.be.instanceof(Date);
                expect(result.lastComplete).to.be.instanceof(Date);
                expect(result.results).to.equal(null);
                let error = result.error;
                expect(error).to.be.instanceof(Object);
                expect(error.message).to.equal(steps[0].config.error);
                expect(typeof(error.stack)).to.equal('string');
            });
    });

    it('simple pipeline (error terminates forked)',() => {
        let steps:SyncPipelineStep[] = [{
            processorId: 'simple',
            module: './processors/TestProcessor',
            config: {
                results: 'step 1'
            }
        },{
            processorId: 'error',
            module: './processors/TestProcessor',
            config: {
                error: 'stop the pipeline here'
            }
        },{
            processorId: 'not run',
            module: './processors/TestProcessor',
            config: {
                results: 'should not be run'
            }
        }];
        return (new SyncPipelineManager(steps,true)).run()
            .then(results => {
                throw Error('should not succeed.');
            })
            .catch(results => {
                expect(results).to.be.instanceof(Array).with.length(2);
                let result = results[0];
                expect(result).to.be.instanceof(Object);
                expect(result.processorId).to.equal(steps[0].processorId);
                expect(result.lastStart).to.be.instanceof(Date);
                expect(result.lastComplete).to.be.instanceof(Date);
                expect(result.error).to.equal(null);
                expect(result.results).to.equal(steps[0].config.results);
                result = results[1];
                expect(result).to.be.instanceof(Object);
                expect(result.processorId).to.equal(steps[1].processorId);
                expect(result.lastStart).to.be.instanceof(Date);
                expect(result.lastComplete).to.be.instanceof(Date);
                expect(result.results).to.equal(null);
                let error = result.error;
                expect(error).to.be.instanceof(Object);
                expect(error.message).to.equal(steps[1].config.error);
                expect(typeof(error.stack)).to.equal('string');
            });
    });
});
