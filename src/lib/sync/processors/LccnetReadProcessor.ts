import { SyncPipelineProcessor, SyncPipelineProcessorConfig } from '../SyncPipelineProcessor';
import * as request from 'request-promise-native';
import { URL } from 'url';

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
     * Parses a URL and returns just the pathname portion.
     *
     * @param u The string URL.
     * @returns The pathname portion.
     */
    protected pathFromUrl(u:string): string{
        return new URL(u).pathname;
    }

    /**
     * Sometimes when lccnet has sat idle for a long time an initial request
     * can sit and not complete for a very long time (think it's running an
     * expensive cron).  This request can sometimes timeout, cause the sync
     * process to stall or even fail.  This function just sends an initial
     * to the site and cares not how long it takes to return, if it errors, etc.
     * It's a hack at best.
     */
    protected cronHack():Promise<void> {
        return new Promise(resolve => {
            request(`${this.config.lccnetwork}`)
                .then(() => {})
                .catch(() => {});
            setTimeout(resolve,500);
        });
    }

    /**
     * Given a base path crawls all matching matching objects and returns them.
     * The `$top` query arg should be on the path and will dictate the page size used for crawling.
     *
     * @param {string} path The path to crawl (e.g. `/api/v1/person?$select=id,email,_links,lccs,orgs,archived&$include_archived&$top=500`)
     * @return Promise that resolves to the full set of objects.
     */
    protected crawlLccnet(path:string):Promise<any[]> {
        return new Promise((resolve,reject) => {
            let results = [];
            const next = (url:string) => {
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
                                        url: this.pathFromUrl(o._links.drupal_self)
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
