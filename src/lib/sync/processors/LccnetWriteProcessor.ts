import { LccnetReadProcessor, LccnetReadProcessorConfig } from './LccnetReadProcessor';
import * as request from 'request-promise-native';
import * as cookies from 'request-cookies';
import * as cheerio from 'cheerio';
import { URL } from 'url';

/**
 * Base configuration for all Lccnet processors that write data as well as read.
 */
export interface LccnetWriteProcessorConfig extends LccnetReadProcessorConfig {
    /** The username used to login to the lccnetwork site */
    username: string;
    /** The password used to loginto the lccnetwork site */
    password: string;
}

/**
 * Base class to hold common config and functionality for SyncPipelineProcessor
 * that read/write from/to an lccnetwork site (local/dev or production).
 */
export abstract class LccnetWriteProcessor<C extends LccnetWriteProcessorConfig,R> extends LccnetReadProcessor<C,R> {
    protected session:LccnetSession;

    /**
     * Start a read/write session.
     *
     * @return Promise resolved with the session (also stored in the session instance varibale).
     */
    protected startSession():Promise<LccnetSession> {
        return (this.session = new LccnetSession(this.config.lccnetwork,this.config.username,this.config.password)).login();
    }
}

/**
 * An authenticated session that can be used to update data in lccnetwork.
 * Must call `login` prior to interacting with `create`, `update`, `delete` or `get`.
 *
 * _Example:_
 * ```
 * const session = new LccnetSession('http://lccnetwork.loc:8888','user','password');
 *
 * session.login()
 *      .then(() => {
 *          console.log(`logged in`);
 *          const o = {
 *              title: 'SciCat Project',
 *              body: 'SciCat Project body',
 *              lccs:[1040],
 *              // people, cooperators,sbid
 *          };
 *          return session.create('/api/v1/project',o)
 *              .then(project => {
 *                  console.log(`CREATED:\n`,project)
 *                  project.title += ' (updated)';
 *                  return session.update(project._links.self,project)
 *                      .then(project => {
 *                          console.log(`UPDATED:\n`,project);
 *                          return session.delete(project._links.self)
 *                              .then(response => console.log(`DELETED\n`,response));
 *                      });
 *              });
 *      })
 *      .catch(err => console.error(`${err.statusCode}`));
 * ```
 */
export class LccnetSession {
    private tokenResponse:any;
    private cookieJar:cookies.CookieJar;
    private baseUrl:URL;

    /**
     * @param {string} url The URL to the lccnetwork site (e.g. `https://lccnetwork.org`)
     * @param {string} username The username for login.
     * @param {string} password The password for username.
     */
    constructor(url:string,private username,private password){
        this.baseUrl = new URL(url);
        this.baseUrl.pathname = '';
    }

    private qualify(path:string):string {
        if(/^https?\:\/\//.test(path)) {
            return path;
        }
        const u = new URL(this.baseUrl.toString())
        u.pathname = path;
        return u.toString();
    }

    private headers() {
        return {
            ...this.tokenResponse,
            Host: this.baseUrl.host,
            Cookie: this.cookieJar.getCookieHeaderString(this.baseUrl.toString())
        };
    }

    private parse(response:string) {
        return cheerio.load(response,{
            normalizeWhitespace: true,
            xmlMode: true,
        });
    }

    private request(path:string,input:any):Promise<any> {
        input.uri = this.qualify(path);
        input.headers = this.headers();
        if(input.body) {
            input.json = true;
        }
        return request(input);
    }

    /**
     * Create an object.
     *
     * @param {string} path The path (or url). (e.g. `/api/v1/project`)
     * @param {any} object The payload of the object to create.
     */
    create(path:string,object:any):Promise<any> {
        return this.request(path,{method:'POST',body:object});
    }

    /**
     * Update an object.
     *
     * @param {string} path The path (or url). (e.g. `/api/v1/project/<id>`)
     * @param {any} object The payload of the object to update.
     */
    update(path:string,object:any):Promise<any> {
        return this.request(path,{method:'PUT',body:object});
    }

    /**
     * Delete an object.
     *
     * @param {string} path The path (or url). (e.g. `/api/v1/project/<id>`)
     */
    delete(path:string):Promise<any> {
        return this.request(path,{method:'DELETE'});
    }

    /**
     * Authenticated get.
     *
     * @param {string} path The path (or url).
     */
    get(path:string) {
        return this.request(path,{method:'GET'});
    }

    /**
     * Login initiating the session.
     *
     * @return {Promise} Resolves with this session object.
     */
    login():Promise<this> {
        const baseUrl_s = this.baseUrl.toString();
        const loginUrl = this.qualify('/user/login');
        return request(loginUrl)
            .then(response => {
                const $ = this.parse(response),
                        params:any = {};
                $('form#user-login input[type="hidden"]')
                    .each(function(i) {
                        let t = $(this);
                        params[t.attr('name')] = t.attr('value');
                    });
                params.name = this.username;
                params.pass = this.password;
                params.op = 'Log in';
                return params;
            })
            .then(params => request({
                method: 'POST',
                uri: loginUrl,
                headers: {
                    Host: this.baseUrl.host,
                    Origin: baseUrl_s,
                    Referer: loginUrl
                },
                form: params,
                resolveWithFullResponse: true,
                followAllRedirects: false,
                simple: false // so 302 doesn't trigger catch
            })
            .then(response => {
                if(response.statusCode !== 302) {
                    throw new Error(`Unexpected response code on login ${response.statusCode}`);
                }
                let headers = response.headers;
                if(!headers['set-cookie']) {
                    throw new Error('No set-cookie after login');
                }
                this.cookieJar = new cookies.CookieJar();
                // feels like a workaround but seems only way for it not to complain
                // about the cookies lccnet/d7 produce
                this.cookieJar._jar.rejectPublicSuffixes = false;
                headers['set-cookie'].forEach(c => this.cookieJar.add(c,baseUrl_s));
                // go get a CSRF token to can make updates
                return this.get('/api/session/token')
                    .then(tokenResponse => {
                        this.tokenResponse = JSON.parse(tokenResponse);
                        return this;
                    });
            }));
    }
}
