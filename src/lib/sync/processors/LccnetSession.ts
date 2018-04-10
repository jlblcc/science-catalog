import * as request from 'request-promise-native';
import * as cookies from 'request-cookies';
import * as cheerio from 'cheerio';
import { URL } from 'url';

/*
const session = new LccnetSession('http://lccnetwork.loc:8888','root','secret');

session.login()
    .then(() => {
        console.log(`logged in`);
        const o = {
            title: 'SciCat Project',
            body: 'SciCat Project body',
            lccs:[1040],
            // people, cooperators,sbid
        };
        return session.create('/api/v1/project',o)
            .then(project => {
                console.log(`CREATED:\n`,project)
                project.title += ' (updated)';
                return session.update(project._links.self,project)
                    .then(project => {
                        console.log(`UPDATED:\n`,project);
                        return session.delete(project._links.self)
                            .then(response => console.log(`DELETED\n`,response));
                    });
            });
    })
    .catch(err => console.error(`${err.statusCode}`));
*/
/**
 * An authenticated session that can be used to update data in lccnetwork.
 */
export class LccnetSession {
    private tokenResponse:any;
    private cookieJar:cookies.CookieJar;
    private baseUrl:URL;

    constructor(url:string,private user,private password){
        this.baseUrl = new URL(url);
        this.baseUrl.pathname = '';
    }

    private qualify(path:string):string {
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
            'X-CSRF-Token': 'TODO'
        });
    }

    private request(path:string,input:any):Promise<any> {
        input.uri = /^https?\:\/\//.test(path) ? path : this.qualify(path);
        input.headers = this.headers();
        if(input.body) {
            input.json = true;
        }
        return request(input);
    }

    create(path:string,object:any):Promise<any> {
        return this.request(path,{method:'POST',body:object});
    }

    update(path:string,object:any):Promise<any> {
        return this.request(path,{method:'PUT',body:object});
    }

    delete(path:string):Promise<any> {
        return this.request(path,{method:'DELETE'});
    }

    get(path:string) {
        return this.request(path,{method:'GET'});
    }

    login():Promise<void> {
        return new Promise((resolve,reject) => {
            const baseUrl_s = this.baseUrl.toString();
            const loginUrl = this.qualify('/user/login');
            request(loginUrl)
                .then(response => {
                    const $ = this.parse(response),
                          params:any = {};
                    $('form#user-login input[type="hidden"]')
                        .each(function(i) {
                            let t = $(this);
                            params[t.attr('name')] = t.attr('value');
                        });
                    params.name = this.user;
                    params.pass = this.password;
                    params.op = 'Log in';
                    request({
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
                            return reject(response);
                        }
                        let headers = response.headers;
                        if(!headers['set-cookie']) {
                            console.error('No set-cookie after login.');
                            return reject(response);
                        }
                        this.cookieJar = new cookies.CookieJar();
                        // feels like a workaround but seems only way for it not to complain
                        // about the cookies lccnet/d7 produce
                        this.cookieJar._jar.rejectPublicSuffixes = false;
                        headers['set-cookie'].forEach(c => this.cookieJar.add(c,baseUrl_s));
                        // go get a CSRF token to can make updates
                        this.get('/api/session/token')
                            .then(tokenResponse => {
                                this.tokenResponse = JSON.parse(tokenResponse);
                                resolve();
                            })
                            .catch(reject);
                    })
                    .catch(reject);
                })
                .catch(reject);
        });
    }
}
