import { SyncPipelineProcessor, SyncPipelineProcessorResults } from '../SyncPipelineProcessor';

/**
 * This is a very simple processor that is used just to test the basic
 * functionality of the pipeline manager.
 */
export default class TestProcessor extends SyncPipelineProcessor {
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
