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
* @param output The output of the Contacts SyncPipelineProcessor.
* @returns A string representation.
 */
export function contactsReport(output:ContactsOutput) {
    return `consolidated ${output.total} contacts down to ${output.consolidated}`;
}

interface Replacement {
    regex: RegExp;
    replace: string;
}

// these are used during normalization to build lists of "equivalent" names
const REPLACEMENTS:Replacement[] = [
    {regex: /(.)&(.)/,replace: '$1 and $2'}, // ampersands (also catches "texas a&m university" = "texas a and m university")
    {regex: /\bdept\b/g, replace: ' department '}, // embedded department
    {regex: /\s\(\w+\)\s/, replace: ' '}, // embedded nicknames like "william (bill) williams"
    {regex: /^(dr)\b/, replace: ''}, // titles at the beginning
    {regex: /\b(dr|phd|inc)$/, replace: ''}, // titles at the end
    {regex: /^(\w{2,})\s+(\w)\s+(\w{2,})$/, replace: '$1 $3'}, // initials "bill w williams" == "bill williams"
    {regex: /\s\(\w+\)$/, replace: ''}, // clarifying abbreviation at the end
    {regex: /\blcc\b/, replace:' landscape conservation cooperative '},
    {regex: /\bnwr\b/, replace: ' national wildlife refuge '},
    {regex: /^bc\s/, replace: 'british columbia '}, // prefix only
    {regex: /\bnoaa\b/, replace: ' national oceanic and atmospheric administration '},
    {regex: /\bnps\b/, replace: ' national park service '},
    {regex: /\bus\s?fws\b/, replace: ' us fish and wildlife service '},
    {regex: /\bus\s?gs\b/, replace: ' us geological survey '},
    {regex: /\bus\s?da\b/, replace: ' us department of agriculture '},
    {regex: /\bus\s?fs\b/, replace: ' us forest service '},
    {regex: /\btnc\b/, replace: ' the nature conservancy '},
    {regex: /\bu\s?s\b/, replace: ' united states '},
    {regex: /\buniv\b/, replace: ' university '},
    {regex: /\buw\b/, replace: ' university of washington '}, // not a big fan
    {regex: /\bwwu\b/, replace: ' western washington university '}, // not a big fan
    {regex: /\sunknown$/, replace: ''}, // many orgs have " Unknown" at the end ??
];

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
                    this.processContact(contacts.pop(),item)
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

    private processContact(c:any,item:ItemDoc):Promise<any> {
            this.results.results.total++;
            let { name, positionName, isOrganization, electronicMailAddress } = c,
                normalized = Contacts.normalize(name),
                emails = (electronicMailAddress||[]).map(addr => addr.trim().toLowerCase()),
                nameLower = name.trim().toLowerCase();

            const onFound = (contact) => {
                return contact ?
                    contact.update({
                        $addToSet: {
                            aliases: { $each: normalized },
                            electronicMailAddress: { $each: emails },
                            _lcc: item._lcc,
                            _item: item._id
                        }
                    }) :
                    (new Contact({
                        name: name,
                        positionName: positionName,
                        isOrganization: isOrganization,
                        aliases: normalized,
                        electronicMailAddress: emails,
                        _lcc: [item._lcc],
                        _item: [item._id],
                    })).save();
            },
            byName = () => {
                return Contact.findOne({
                    aliases: {$in : normalized},
                    isOrganization: isOrganization
                })
                .then(onFound);
            };
            return emails.length ?
                // if there is an e-mail address then try to match on that and isOrganization
                // otherwise strictly consolidate by name
                Contact.findOne({
                    electronicMailAddress: {$in :emails},
                    isOrganization: isOrganization
                }).then(contact => {
                    if(contact) {
                        return onFound(contact);
                    }
                    return byName();
                }) :
                byName();
    }

    public static normalize(name:string):string[] {
        let arr = [name.toLowerCase()
                    .replace(/[\.,'’:;]/g,'') // punctuation
                    .replace(/[-\/]/g,' ') // separators
                    .replace(/\s+/g,' ')
                    .trim()];
        REPLACEMENTS.forEach(rp => {
            arr.forEach(n => {
                if(rp.regex.test(n)) {
                    arr.push(n.replace(rp.regex,rp.replace)
                               .replace(/\s+/g,' ').trim()); // to be safe always collapse any spaces and trim
                }
            });
        });
        return arr;
    }
}
