import { SyncPipelineProcessorResults } from '../SyncPipelineProcessor';
import { LccnetReadProcessor, LccnetReadProcessorConfig } from './LccnetReadProcessor';

import { Contact, ContactDoc } from '../../../db/models';
import Contacts from './Contacts';

import { LogAdditions } from '../../log';
import { QueryCursor } from 'mongoose';

import * as request from 'request-promise-native';

/**
 * The output of the LccnetContactAlignment processor.
 */
export class LccnetContactAlignmentOutput {
    total = 0;
    totalLccnetOrganizations = 0;
    mappedOrganizations = 0;
    totalLccnetPeople = 0;
    mappedPeople = 0;
}

/**
 * Configuration for the LccnetContactAlignment procesor.
 */
export interface LccnetContactAlignmentConfig extends LccnetReadProcessorConfig {
}

/**
 * Translates the process output into a report string.
 *
 * @param output The output of the processor.
 * @returns A string representation.
 */
export function lccnetContactAlignmentReport(output:LccnetContactAlignmentOutput) {
    return `
Total: ${output.total}
Total LCCNET Organizations: ${output.totalLccnetOrganizations}
Mapped Organizations: ${output.mappedOrganizations}
Total LCCNET People: ${output.totalLccnetPeople}
Mapped People: ${output.mappedPeople}
`;
}

/**
 * This processor attempts to align existing people/organization with the Contact
 * collection (i.e. populate the `lccnet` property if possible).
 *
 * @todo add Logging
 */
export default class LccnetContactAlignment extends LccnetReadProcessor<LccnetContactAlignmentConfig,LccnetContactAlignmentOutput> {
    private lccnetPeople:any[];
    private lccnetPeopleMap:any;
    private lccnetOrgs:any[];
    private lccnetOrgsMap: any;

    run():Promise<SyncPipelineProcessorResults<LccnetContactAlignmentOutput>> {
        return new Promise((resolve,reject) => {
            this.results.results = new LccnetContactAlignmentOutput();
            this.crawlLccnet('/api/v1/person?$select=id,email,_links,lccs,orgs,archived&$include_archived&$top=500')
                .then(people => {
                    this.lccnetPeople = people;
                    this.results.results.totalLccnetPeople = people.length;
                    this.lccnetPeopleMap = people.reduce((map,p) => {
                            if(p.email) {
                                map[p.email.toLowerCase()] = p;
                            }
                            return map;
                        },{});
                    return this.crawlLccnet('/api/v1/organization?$select=id,name,aliases,email_domains,_links&$top=500')
                })
                .then(orgs => {
                    this.results.results.totalLccnetOrganizations = orgs.length;
                    orgs.forEach(o => {
                        o.aliases = o.aliases||[];
                        o.aliases.push(o.name);
                        o.aliases = o.aliases.reduce((arr,a) => {
                            arr = arr.concat(Contacts.normalize(a));
                            return arr;
                        },[]);
                    });
                    this.lccnetOrgs = orgs;
                    this.lccnetOrgsMap = orgs.reduce((map,o) => {
                            o.aliases.forEach(a => map[a] = o);
                            return map;
                        },{});
                    Contact.find({})
                        .exec()
                        .then(contacts => {
                            const next = () => {
                                if(!contacts.length) {
                                    return resolve(this.results);
                                }
                                this.results.results.total++;
                                let c:ContactDoc = contacts.pop(),
                                    promise = c.isOrganization ?
                                        this.processOrganization(c) :
                                        this.processPerson(c);
                                    promise.then(next).catch(reject);
                            };
                            next();
                        })
                        .catch(reject);
                });
        });
    }

    private processOrganization(contact:ContactDoc):Promise<void> {
        return new Promise((resolve,reject) => {
            let lccnetOrg = contact.aliases
                .reduce((found,a) => found||(this.lccnetOrgsMap[a] ? this.lccnetOrgsMap[a] : undefined),undefined);
            if(lccnetOrg) {
                contact.lccnet = lccnetOrg.lccnet;
                contact.save()
                    .then(() => {
                        this.results.results.mappedOrganizations++;
                        resolve();
                    }).catch(reject);
            } else {
                resolve();
            }
        });
    }

    private processPerson(contact:ContactDoc):Promise<void> {
        return new Promise((resolve,reject) => {
            let lccnetPerson = contact.electronicMailAddress
                .reduce((found,email) => found||(this.lccnetPeopleMap[email] ? this.lccnetPeopleMap[email] : undefined),undefined);
            if(lccnetPerson) {
                contact.lccnet = lccnetPerson.lccnet;
                contact.save()
                    .then(() => {
                        this.results.results.mappedPeople++;
                        resolve();
                    }).catch(reject);
            } else {
                resolve();
            }

        });
    }
}
