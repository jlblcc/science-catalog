import { SyncPipelineProcessor, SyncPipelineProcessorConfig, SyncPipelineProcessorResults } from '../SyncPipelineProcessor';

import { Item, ItemDoc, Contact } from '../../../db/models';

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

export default class Contacts extends SyncPipelineProcessor<ContactsConfig,ContactsOutput> {
    run():Promise<SyncPipelineProcessorResults<ContactsOutput>> {
        return new Promise((resolve,reject) => {
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
        });
    }

    private processContacts(item:ItemDoc):Promise<any> {
        return new Promise((resolve,reject) => {
            Promise.all((item.mdJson.contact||[]).map(c => this.processContact(c)))
                .then(resolve)
                .catch(reject);
        });
    }

    private processContact(c:any):Promise<any> {
            this.results.results.total++;
            let { name, positionName, contactType, isOrganization, electronicMailAddress } = c,
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
                            aliases: name.toLowerCase(),
                            electronicMailAddress: { $each: emails }
                        }
                    }) :
                    (new Contact({
                        name: normalized,
                        positionName: positionName,
                        isOrganization: isOrganization,
                        contactType: contactType,
                        aliases: [name.toLowerCase()],
                        electronicMailAddress: emails
                    })).save();
            });
            /*
            return Contact.findOneAndUpdate({
                    name: normalized,
                    isOrganization: isOrganization
                },{
                    name: normalized,
                    positionName: positionName,
                    isOrganization: isOrganization,
                    contactType: contactType ? contactType.toLowerCase() : contactType,
                    //$setOnInsert: { aliases: [name.toLowerCase()]},
                    $addToSet: { aliases: name.toLowerCase() }
                },UPSERT_OPTIONS).exec();*/
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
                .replace(/\sDc\s/,' D.C. ');
    }
}
