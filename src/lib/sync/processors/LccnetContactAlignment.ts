import { SyncPipelineProcessorResults } from '../SyncPipelineProcessor';
import { LccnetReadProcessor, LccnetReadProcessorConfig } from './LccnetReadProcessor';

import { Contact, ContactDoc } from '../../../db/models';
import Contacts from './Contacts';

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
 * Logging codes for the LccnetContactAlignment SyncPipelineProcessor
 */
export enum LccnetContactAlignmentCodes {
    /** Begin loading people from lccnetwork. */
    LOADING_PEOPLE = 'loading_people',
    /** Begin loading organizations from lccnetwork. */
    LOADING_ORGS = 'loading_orgs',
    /** Begin processing local contacts. */
    PROCESSING_CONTACTS = 'processing_contacts'
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
 * This processor loads up the contact database of people and organizations from lccnetwork.org and cross-references
 * those contacts with the documents in the `Contact` collection.  When a contact is found to align the `lccnet` property
 * is set on the document in the `Contact` collection to make note of the id within lccnetwork and the URL of that contact.
 */
export default class LccnetContactAlignment extends LccnetReadProcessor<LccnetContactAlignmentConfig,LccnetContactAlignmentOutput> {
    private lccnetPeople:any[];
    private lccnetPeopleMap:any;
    private lccnetOrgs:any[];
    private lccnetOrgsMap: any;

    run():Promise<SyncPipelineProcessorResults<LccnetContactAlignmentOutput>> {
        this.results.results = new LccnetContactAlignmentOutput();
        this.cronHack(); // not sure why there were two, but leaving since it can't really hurt
        return this.cronHack()
            .then(() => this.log.info(`[${LccnetContactAlignmentCodes.LOADING_PEOPLE}]`,{code: LccnetContactAlignmentCodes.LOADING_PEOPLE}))
            .then(() => this.crawlLccnet('/api/v1/person?$select=id,email,_links,lccs,orgs,archived&$include_archived&$top=500'))                
            .then(people => {
                this.lccnetPeople = people;
                this.results.results.totalLccnetPeople = people.length;
                this.lccnetPeopleMap = people.reduce((map,p) => {
                        if(p.email) {
                            map[p.email.toLowerCase()] = p;
                        }
                        return map;
                    },{});
                return this.log.info(`[${LccnetContactAlignmentCodes.LOADING_ORGS}]`,{code: LccnetContactAlignmentCodes.LOADING_ORGS});
            })
            .then(() => this.crawlLccnet('/api/v1/organization?$select=id,name,aliases,email_domains,_links&$top=500'))
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
                return this.log.info(`[${LccnetContactAlignmentCodes.PROCESSING_CONTACTS}]`,{code: LccnetContactAlignmentCodes.PROCESSING_CONTACTS});
            })
            .then(() => Contact.find({}).cursor()
                .eachAsync(contact => {
                    this.results.results.total++;
                    return contact.isOrganization
                        ? this.processOrganization(contact)
                        : this.processPerson(contact);
                })
                .then(() => {
                    const {total,totalLccnetOrganizations,totalLccnetPeople,mappedOrganizations,mappedPeople} = this.results.results;
                    return this.log.debug(`(catalog/lccnet) total: ${total}/${totalLccnetPeople+totalLccnetOrganizations} mapped orgs:${mappedOrganizations}/${totalLccnetOrganizations} mapped people:${mappedPeople}/${totalLccnetPeople}`);
                })
                .then(() => this.results));
    }

    private processOrganization(contact:ContactDoc):Promise<void> {
        const lccnetOrg = contact.aliases.reduce((found,a) => found||(this.lccnetOrgsMap[a] ? this.lccnetOrgsMap[a] : undefined),undefined);
        if(lccnetOrg) {
            contact.lccnet = lccnetOrg.lccnet;
            return contact.save().then(() => { this.results.results.mappedOrganizations++; });
        }
        return Promise.resolve();
    }

    private processPerson(contact:ContactDoc):Promise<void> {
        const lccnetPerson = contact.electronicMailAddress.reduce((found,email) => found||(this.lccnetPeopleMap[email] ? this.lccnetPeopleMap[email] : undefined),undefined);
        if(lccnetPerson) {
            contact.lccnet = lccnetPerson.lccnet;
            return contact.save().then(() => { this.results.results.mappedPeople++; });
        }
        return Promise.resolve();
    }
}
