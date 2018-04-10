import { SyncPipelineProcessor, SyncPipelineProcessorConfig } from '../SyncPipelineProcessor';
import * as request from 'request-promise-native';

/**
 * Base configuration for all Lccnet specific processors.
 */
export interface LccnetReadProcessorConfig extends SyncPipelineProcessorConfig{
    /** The base URL to the lccnetwork site (e.g. https://lccnetwork.org) */
    lccnetwork: string;
}

/**
 * Base class to hold common config and functionality for SyncPipelineProcessor
 * that read from an lccnetwork site (local/dev or production).
 */
export abstract class LccnetReadProcessor<C extends LccnetReadProcessorConfig,R> extends SyncPipelineProcessor<C,R> {
    /**
     * Given a base path crawls all matching matching objects and returns them.
     * The `$top` query arg should be on the path and will dictate the page size used for crawling.
     *
     * @param {string} path The path to crawl (e.g. `/api/v1/person?$select=id,email,_links,lccs,orgs,archived&$include_archived&$top=500`)
     * @return Promise that resolves to the full set of objects.
     */
    protected crawlLccnet(path:string):Promise<any[]> {
        return new Promise((resolve,reject) => {
            let results = [],
                next = (url:string) => {
                    request(url)
                        .then((response:any) => {
                            response = JSON.parse(response);
                            if(response.list) {
                                results = results.concat(response.list);
                            }
                            if(response._links && response._links.next) {
                                next(response._links.next);
                            } else {
                                // generate an lccnetRef for each contact up front
                                results.forEach(o => {
                                    o.lccnet = {
                                        id: o.id,
                                        url: o._links.drupal_self
                                    };
                                });
                                resolve(results);
                            }
                        })
                        .catch(reject);
                };
            next(`${this.config.lccnetwork}${path}`);
        });
    }
}
