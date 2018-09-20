import { SyncPipelineProcessor, SyncPipelineProcessorConfig, SyncPipelineProcessorResults } from '../SyncPipelineProcessor';

import { Item, ItemDoc, Contact } from '../../../db/models';

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
    /* specific aliases like this should be dealt with on the lccnetwork site
    {regex: /\buw\b/, replace: ' university of washington '}, // not a big fan
    {regex: /\bwwu\b/, replace: ' western washington university '}, // not a big fan
    */
    {regex: /\sunknown$/, replace: ''}, // many orgs have " Unknown" at the end ??
];

/**
 * For all items in the `Item` collection process the `mdJson.contact` and build/update
 * the contents of the `Contact` collection aligning contacts based on email/organization
 * if possible and name/organization otherwise.
 * 
 * @todo This relies on 'name' always being available for a contact.  It's not technically required for a contact but for the data set is always there.
 */
export default class Contacts extends SyncPipelineProcessor<ContactsConfig,ContactsOutput> {
    /**
     * Execute the processor.
     */
    run():Promise<SyncPipelineProcessorResults<ContactsOutput>> {
        const go = ():Promise<SyncPipelineProcessorResults<ContactsOutput>> => {
            this.results.results = new ContactsOutput();
            return Item.find({}).cursor()
                .eachAsync((item:ItemDoc) => this.processContacts(item))
                .then(() => Contact.count({})
                        .then((n:number) => {
                            this.results.results.consolidated = n;
                            return this.results;
                        }));
        };
        return this.config.force
            ? Contact.remove({}).exec().then(go)
            : go();
    }

    /**
     * Process all contacts for a single item.  This function processes the
     * item's contacts serially since a given item can have the same contact listed
     * multiple times with different contactIds (perhaps playing different roles).
     * (E.g. `{'mdJson.contact.name':'Mary Oakley'}`)
     * 
     * @param item The item.
     */
    private processContacts(item:ItemDoc):Promise<void> {
        return (item.mdJson.contact||[])
            .map(c => () => this.processContact(c,item))
            .reduce((p,f) => p.then(f), Promise.resolve());
    }

    /**
     * Process a single contact, merging/updating an existing contact
     * document or creating a new one if necessary.
     * 
     * @param c The contact.
     * @param item The item.
     */
    private processContact(c:any,item:ItemDoc):Promise<any> {
        this.results.results.total++;
        const { name, positionName, isOrganization, electronicMailAddress } = c,
            normalized = Contacts.normalize(name),
            emails = (electronicMailAddress||[]).map(addr => addr.trim().toLowerCase());

        const onFound = (contact) => contact
            ? contact.update({
                $addToSet: {
                    aliases: { $each: normalized },
                    electronicMailAddress: { $each: emails },
                    _lcc: item._lcc,
                    _item: item._id
                }
            })
            : (new Contact({
                name: name,
                positionName: positionName,
                isOrganization: isOrganization,
                aliases: normalized,
                electronicMailAddress: emails,
                _lcc: [item._lcc],
                _item: [item._id],
            })).save();
        const byName = () => Contact.findOne({
                aliases: {$in : normalized},
                isOrganization: isOrganization
            })
            .then(onFound);

        // if there is an e-mail address then try to match on that and isOrganization
        // otherwise strictly consolidate by name
        return emails.length
            ? Contact.findOne({
                electronicMailAddress: {$in :emails},
                isOrganization: isOrganization
            }).then(contact => contact ? onFound(contact) : byName())
            : byName();
    }

    /**
     * Given a contact name generate a list of "aliases" that can be used for
     * cross referencing contacts.
     * 
     * @param name The contact name.
     */
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
