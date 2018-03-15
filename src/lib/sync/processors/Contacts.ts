import { SyncPipelineProcessor, SyncPipelineProcessorConfig, SyncPipelineProcessorResults } from '../SyncPipelineProcessor';

import { Item, ItemDoc, Contact, ContactDoc } from '../../../db/models';

import { LogAdditions } from '../../log';
import { QueryCursor } from 'mongoose';

const UPSERT_OPTIONS = {
    upsert: true,
    new: true
};

/**
 * The output of the contacts processor.
 */
export class ContactsOutput {
    total = 0;
    consolidated = 0;
}

/**
 * Configuration for the contacts processor.
 */
export interface ContactsConfig extends SyncPipelineProcessorConfig {
    /** Should the Contact collection be clobbered and re-built? (use with caution) */
    force: boolean;
}

/**
* Translates the processor output into a report string.
*
* @param results The output of the Contacts SyncPipelineProcessor.
* @returns A string representation.
 */
export function contactsReport(output:ContactsOutput) {
    return `consolidated ${output.total} contacts down to ${output.consolidated}`;
}

const PREFIXES = {
    Us: 'U.S.',
    Uc: 'U.C.',
    Dc: 'D.C.',
    Usda: 'USDA',
    Usfws: 'USFWS',
    Usgs: 'USGS',

    Usfs: 'USFS',
};

const ABBREVIATIONS = {
    'USFWS' : 'U.S. Fish and Wildlife Service',
    'USGS' : 'U.S. Geological Survey',
    'USFS' : 'U.S. Forest Service',
    'NPS' : 'National Park Service',
};

/**
 * @todo This relies on 'name' always being available for a contact.  It's not technically required for a contact but for the data set is always there.
 */
export default class Contacts extends SyncPipelineProcessor<ContactsConfig,ContactsOutput> {
    run():Promise<SyncPipelineProcessorResults<ContactsOutput>> {
        return new Promise((resolve,reject) => {
            let go = () => {
                this.results.results = new ContactsOutput();
                let cursor:QueryCursor<ItemDoc> = Item.find({}).cursor(),
                    next = () => {
                        cursor.next()
                            .then((item:ItemDoc) => {
                                if(!item) {
                                    return Contact.count({})
                                        .then((n:number) => {
                                            this.results.results.consolidated = n;
                                            resolve(this.results);
                                        })
                                        .catch(reject);
                                }
                                this.processContacts(item)
                                    .then(next)
                                    .catch(reject);
                            })
                            .catch(reject);
                    };
                next();
            };
            if(this.config.force) {
                Contact.remove({})
                    .exec()
                    .then(go)
                    .catch(reject);
            } else {
                go();
            }
        });
    }

    private processContacts(item:ItemDoc):Promise<any> {
        // need to process contacts serially since a given Item can
        // have hte same contact listed multiple times with different
        // contactIds (playing different roles I guess)
        // {'mdJson.contact.name':'Mary Oakley'}
        return new Promise((resolve,reject) => {
            let contacts = (item.mdJson.contact||[]).slice(0),
                next = () => {
                    if(!contacts.length) {
                        return resolve();
                    }
                    this.processContact(contacts.pop())
                        .then(next)
                        .catch(reject);
                };
            next();
            /*
            Promise.all((item.mdJson.contact||[]).map(c => this.processContact(c)))
                .then(resolve)
                .catch(reject);*/
        });
    }

    private processContact(c:any):Promise<any> {
            this.results.results.total++;
            let { name, positionName, isOrganization, electronicMailAddress } = c,
                normalized = Contacts.normalize(name),
                emails = (electronicMailAddress||[]).map(addr => addr.toLowerCase());
            return Contact.findOne({
                name: normalized,
                isOrganization: isOrganization
            })
            .then(contact => {
                return contact ?
                    contact.update({
                        $addToSet: {
                            aliases: name.trim().toLowerCase(),
                            electronicMailAddress: { $each: emails }
                        }
                    }) :
                    (new Contact({
                        name: normalized,
                        positionName: positionName,
                        isOrganization: isOrganization,
                        aliases: [name.trim().toLowerCase()],
                        electronicMailAddress: emails
                    })).save();
            });
    }

    public static normalize(name:string):string {
        name = name.trim();
        // if all caps generally leave it alone, aside for some common
        if(/^[A-Z]$/.test(name)) {
            return ABBREVIATIONS[name]||name;
        }
        name = name
            .toLowerCase()
            .replace(/\./g,'') // drop periods from abbreviations
            .replace(/’/g,'\'') // funny quote
            .replace('&','and')
            .replace(/^us fws\s/,'usfws ')
            .replace(/^us gs\s/,'usgs ')
            .replace(/\su\ss\s/,' us ')
            .replace(/\su\sc\s/,' uc ')
            .replace(/^u\ss\s/,'us ')
            .replace(/^u\sc\s/,'uc ')
            .replace(/^([a-z]+)\s?[-\/\:]/,'$1 ') // e.g. USFS- or USFS -
            .replace(/(\w),\s(\w)/,'$1 - $2') // x, y => x - y
            .replace(/\s+/g,' ') // collapse multiple spaces
            .replace(/\sunknown$/,''); // many end in...
        if(ABBREVIATIONS[name.toUpperCase()]) {
            return ABBREVIATIONS[name.toUpperCase()]
        }
        let normalized = '',
            i,c,lc;
        for(i = 0;i < name.length; i++) {
            c = name.charAt(i);
            if(typeof(lc) === 'undefined' || lc === ' ' || lc === '(' /*/\b/.test(lc)*/) {
                normalized += c.toUpperCase();
            } else {
                normalized += c;
            }
            lc = c;
        }
        i = normalized.indexOf(' ');
        if(i !== -1) {
            let first = normalized.substring(0,i);
            if(PREFIXES[first]) {
                normalized = PREFIXES[first] + normalized.substring(i);
            }
        }
        return normalized
                .replace(/\sAnd\s/,' and ')
                .replace(/\sOf\s/,' of ')
                .replace(/\sUs\s/,' U.S. ')
                .replace(/\sDc\s/,' D.C. ')
                .replace(/\sDoi\s/,' DOI ');
    }

    public static findContactByName(name:string):Promise<ContactDoc> {
        return Contact.findOne({aliases:name.trim().toLowerCase()}).exec();
    }
}
