import { SyncPipelineProcessor, SyncPipelineProcessorConfig, SyncPipelineProcessorResults } from '../SyncPipelineProcessor';

/**
 * Configuration input for the test processor.
 */
export interface TestProcessorConfig extends SyncPipelineProcessorConfig {
    /** Error message the processor should generate an error with */
    error?:string;
    /** If the process should die with a runtime (coding) error */
    runtimeException?:boolean;
    /** Number of milliseconds the processor should pause before resolving */
    wait?: number;
    /** Results the processor should resolve with */
    results?:any;
    /** Data the processor should resolve with */
    data?:any;
}
/**
 * This is a very simple processor that is used just to test the basic
 * functionality of the pipeline manager.
 */
export default class TestProcessor extends SyncPipelineProcessor<TestProcessorConfig> {
    run():Promise<SyncPipelineProcessorResults> {
        return new Promise((resolve,reject) => {
            let done = () => {
                if(this.config.error) {
                    this.log.error(this.config.error);
                    return reject(new Error(this.config.error));
                } else if (this.config.runtimeException) {
                    // tests rte
                    let foo = null;
                    console.log('foo.bar');
                }
                let output = {
                    results: this.config.results,
                    data: this.config.data
                };
                this.log.info(`resolving with ${JSON.stringify(output)}`)
                resolve(output);
            };
            if(this.config.wait) {
                setTimeout(done,this.config.wait);
            } else {
                done();
            }
        });
    }
}
