import * as express from 'express';

import Resource = require('odata-resource');
import * as BodyParser from 'body-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as truncateHtml from 'truncate-html';

import { Request, Response } from 'express';
import { DocumentQuery } from 'mongoose';

import AppConfiguration from './config';

import { Item, ItemDoc,
         Lcc,
         SyncPipelineProcessorEntry,
         SyncPipelineProcessorLog } from './db/models';

import { BASE_URI, BASE_API_URI } from './uris';

/*
wanted to use this in qaqc but cannot because the map/reduce logic runs
in mongo so the list of valid roles must be defined in that context
(nothing from the external scope can be referenced)
import { ROLES as responsiblePartyRoles } from './qaqc/responsiblePartyRoles';

const RESPONSIBLE_PARTY_VALID_ROLES = responsiblePartyRoles.map(o => o.codeName);
console.log(RESPONSIBLE_PARTY_VALID_ROLES);
*/

/** Base resource configuration that disables POST,PUT and DELETE */
const READONLY = {
    create: false,
    update: false,
    delete: false
};

declare function emit(k, v);

class ItemResource extends Resource<ItemDoc> {
    private _findQuery(req:Request):DocumentQuery<ItemDoc[],ItemDoc> {
        let query = this.initQuery(this.getModel().find(),req) as DocumentQuery<ItemDoc[],ItemDoc>;
        if(req.query.$text) {
            query.and([{$text: {$search: req.query.$text}}]);
        }
        return query;
    }
    protected _distinctQuery(req:Request) {
        let query = this.getModel().find();
        if(req.query.$filter) {
            ItemResource.parseFilter(query,req.query.$filter);
        }
        if(req.query.$text) {
            query.and([{$text: {$search: req.query.$text}}]);
        }
        return query;
    }
    // override find and add parameter for $text (keyword) search
    find(req:Request,res:Response) {
        this._findQuery(req).exec((err,items) => {
            if(err) {
                return Resource.sendError(res,500,`find failed`,err);
            }
            let ellipsisLength = typeof(req.query.$ellipsis) !== 'undefined' ? parseInt(req.query.$ellipsis) : NaN,
                postMapper = !isNaN(ellipsisLength) ? (o) => {
                    if(o && o.simplified && o.simplified.abstract) {
                        o.simplified.abstract = truncateHtml(o.simplified.abstract,ellipsisLength,{
                            stripTags: true,
                            ellipsis: ' ...'
                        });
                    }
                    return o;
                } : null;
            this._findListResponse(req,res,items,postMapper);
        });
    }

    findById(req:Request,res:Response,next?:Resource.NEXT) {
        const query = this.initQuery(this.getModel().findById(req._resourceId),req) as DocumentQuery<ItemDoc,ItemDoc>;
        if(typeof(req.query.$expand_relationships) !== 'undefined') {
            query.populate('_products','simplified files');
            query.populate('_project','simplified files');
        }
        query.exec((err,obj) => {
            if(err || !obj) {
                Resource.sendError(res,404,'not found',err);
            } else {
                this.singleResponse(req,res,obj,null,next);
            }
        });
    }

    count(req:Request,res:Response) {
        this._findQuery(req).count((err,n) => {
            if(err) {
                return Resource.sendError(res,500,`find failed`,err);
            }
            return res.json(n);
        });
    }
}

/**
 * The base express API server.
 */
export class Server {
    public express;
    public config:any;

    constructor() {
        let app = this.express = express();
        app.use(BodyParser.json());
        app.use(`${BASE_URI}`, express.static(path.join(__dirname,'public')));
        app.get('/',(req,res) => res.redirect(`${BASE_URI}/app`));
        app.get(`${BASE_URI}`,(req,res) => res.redirect(`${BASE_URI}/app`));
        // This route returns the list of application source .js/css files
        // required for the application to function.  Using a simple web service
        // since Angular changes these paths build to build and they also differ
        // from development to production builds.  When included elsewhere this
        // endpoint can be used to dynamically include the necessary content.
        // files are returned in the order they should be included
        app.get(`${BASE_URI}/app-src`,(req,res) => {
            fs.readdir(path.join(__dirname,'public/app'),(err,items) => {
                if(err) {
                    return Resource.sendError(res,500,`directory listing`,err);
                }
                const order = ['inline','polyfills','scripts','styles','vendor','main'],
                      pfx = (f) => f.substring(0,f.indexOf('.'));
                res.send(items.filter(i => /\.(js|css)$/.test(i)).sort((a,b) => order.indexOf(pfx(a)) - order.indexOf(pfx(b))));
            });

        });
        if(AppConfiguration.cors && AppConfiguration.cors['Access-Control-Allow-Origin']) {
            const allowedOrigins =
                AppConfiguration.cors['Access-Control-Allow-Origin'].split(/\s+/)
                    .map(o => o.toLowerCase());
            app.get(`${BASE_API_URI}/*`,(req,res,next) => {
                const origin = req.headers.origin ?
                    req.headers.origin.toLowerCase() : null;
                if(origin && allowedOrigins.indexOf(origin) !== -1) {
                    res.set({
                        ...AppConfiguration.cors,
                        'Access-Control-Allow-Origin': req.headers.origin
                    })
                }
                next();
            });
        }
        this.init();
    }

    /**
     * Initializes the resources.
     */
    private init() {
        let item = new ItemResource({...READONLY,...{
            rel: `${BASE_API_URI}/item`,
            model: Item,
            // query arg defaults
            $top: 25,
            $orderby: 'title',
            $orderbyPaged: 'title',
            count: true,
            //populate: ['_lcc']
        }});
        item.staticLink('distinct',function(req,res) {
            if(!req.query.$select) {
                return Resource.sendError(res,400,'Missing required parameter $select');
            }
            let query = this._distinctQuery(req),
                regex;
            if (req.query.$contains) {
                // this kind of duplicates with $filter could do BUT will trim
                // what distinct is run over and THEN further trim the resulting values
                // this is because distinct over an array of objects will return the whole
                // item which will almost certainly contain other hits within that array
                regex = new RegExp(req.query.$contains.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"),'i');
                const where = {};
                where[req.query.$select] = { $regex: regex };
                query.where(where);
            }
            query.distinct(req.query.$select)
                .then(values => {
                    if(regex) {
                        values = values.filter(v => regex.test(v));
                    }
                    res.send(values.sort());
                })
                .catch(err => Resource.sendError(res,500,`distinct ${req.query.$select}`,err));
        });

        item.staticLink('qaqcIssues',function(req,res) {
            const query = this.getModel().find({simplified:{$exists: true}});
            item.getModel().mapReduce({
                query: query,
                map: function() {
                    const RESPONSIBLE_PARTY_VALID_ROLES = [
                        'resourceProvider','custodian','owner','use','distributor','originator',
                        'pointOfContact','principalInvestigator','processor','publisher','author',
                        'sponsor','coAuthor','collaborator','editor','mediator','rightsHolder',
                        'contributor','funder','stakeholder','administrator','client','logistics',
                        'coPrincipalInvestigator','observer','curator' ];
                    const VALID_RESOURCE_TYPES = ['attribute','attributeType','collectionHardware','collectionSession','dataset','series',
                    'nonGeographicDataset','dimensionGroup','feature','featureType','propertyType','fieldSession',
                    'software','service','model','tile','metadata','initiative','sample','document','repository',
                    'aggregate','product','collection','coverage','application','sciencePaper','userGuide',
                    'dataDictionary','website','publication','report','awardInfo','collectionSite','project',
                    'factSheet','tabularDataset','map','drawing','photographicImage','presentation'];
                    const FWS_FUNDING_SOURCES = ['Aleutian Bering Sea Islands LCC','Arctic Landscape Conservation Cooperative',
                    'California Landscape Conservation Cooperative','Fisheries and Ecological Services','Great Northern Landscape Conservation Cooperative',
                    'Gulf Coastal Plains and Ozarks Landscape Conservation Cooperative','Kodiak National Wildlife Refuge','Landscape Conservation Cooperative Network',
                    'Landscape Conservation Cooperative Network, National Office','Mary Mahaffy','Migratory Bird Management','Migratory Birds Program','National Wildlife Refuge System',
                    'North Atlantic Landscape Conservation Cooperative','North Pacific LCC','Northwest Boreal Landscape Conservation Cooperative',
                    'NWRS Division of Realty and Natural Resources','Office of Science Applications','Pacific Islands Landscape Conservation Cooperative',
                    'Peninsular Florida Landscape Conservation Cooperative','Science Applications - Region 4','Selawik National Wildlife Refuge',
                    'Togiak National Wildlife Refuge','US Fish & Wildife Service','US Fish and Wildlife Service (Reg 7)','Western Alaska Landscape Conservation Cooperative',
                    'Yukon Delta National Wildlife Refuge',/* 'U.S. Fish and Wildlife Service', this the right one */
                    ];

                    let doc = this as ItemDoc,
                        simplified = doc.simplified,
                        issues:any = {
                            allocUnspecifiedRecipient: [],
                            allocUnspecifiedRecipientType: [],
                            allocUnspecifiedSource: [],
                            allocUnspecifiedSourceType: [],
                            allocMissingFiscalYear: [],
                            allocMultipleFiscalYears: [],
                            allocUsFws: [],
                            duplicateContactName: [],
                            responsiblePartyInvalidRole: [],
                            resourceTypeInvalid: []
                        };
                    const newIssue = ():any[] => [{_id:doc._id,lccnet:simplified ? simplified.lccnet : null}];
                    const addInfoToIssue = (issue:any[],info:any):any[] => {
                        issue[0].info = issue[0].info||[];
                        if(issue[0].info.indexOf(info) === -1) {
                            issue[0].info.push(info);
                        }
                        return issue;
                    };
                    const docHasIssue:any[] = newIssue();
                    if(simplified) {
                        if(simplified.funding && simplified.funding.allocations) {
                            const matching = simplified.funding.allocations.matching||[],
                                nonMatching = simplified.funding.allocations.nonMatching||[],
                                allAllocations = matching.concat(nonMatching);
                            
                            const allocUsFwsIssue:any[] = newIssue();
                            allAllocations.forEach(a => {
                                if(!a.source) {
                                    issues.allocUnspecifiedSource = docHasIssue;
                                } else if (!a.source.contactType) {
                                    issues.allocUnspecifiedSourceType = docHasIssue;
                                }
                                if (a.source && a.source.name && FWS_FUNDING_SOURCES.indexOf(a.source.name) !== -1) {
                                    issues.allocUsFws = addInfoToIssue(allocUsFwsIssue,a.source.name);
                                }
                                if(!a.recipient) {
                                    issues.allocUnspecifiedRecipient = docHasIssue;
                                } else if (!a.recipient.contactType) {
                                    issues.allocUnspecifiedRecipientType = docHasIssue;
                                }
                                if(!a.fiscalYears || a.fiscalYears.length === 0) {
                                    issues.allocMissingFiscalYear = docHasIssue;
                                } else if(a.fiscalYears && a.fiscalYears.length > 1) {
                                    issues.allocMultipleFiscalYears = docHasIssue;
                                }
                            });
                        }
                        if(simplified.contacts) {
                            const names = [];
                            const namesIssue:any[] = newIssue();
                            simplified.contacts.forEach(c => {
                                if(names.indexOf(c.name) === -1) {
                                    names.push(c.name);
                                } else {
                                    
                                    issues.duplicateContactName = addInfoToIssue(namesIssue,c.name);
                                }
                            });
                        }
                        const responsiblePartyIssue:any[] = newIssue();
                        Object.keys(simplified.responsibleParty||{}).forEach(key => {
                            if(RESPONSIBLE_PARTY_VALID_ROLES.indexOf(key) === -1) {
                                
                                issues.responsiblePartyInvalidRole = addInfoToIssue(responsiblePartyIssue,key);
                            }
                        });
                        const resourceTypeIssue:any[] = newIssue();
                        (simplified.resourceType||[]).forEach(rt => {
                            if(VALID_RESOURCE_TYPES.indexOf(rt.type) === -1) {
                                issues.resourceTypeInvalid = addInfoToIssue(resourceTypeIssue,rt.type);
                            }
                        });
                    }
                    if(Object.keys(issues).reduce((hasIssue,key) => {
                            return hasIssue||(issues[key].length ? true : false);
                        },false)) {
                        emit(doc._lcc,issues);
                    }
                },
                reduce: function(key,values:any[]) {
                    return values.reduce((issues,i) => {
                        Object.keys(issues).forEach(key => {
                            if(issues[key] instanceof Array && i[key] instanceof Array) {
                                // should always be one or zero but.
                                i[key].forEach(v => issues[key].push(v));
                            }
                        });
                        return issues;
                    },{
                        allocUnspecifiedRecipient: [],
                        allocUnspecifiedRecipientType: [],
                        allocUnspecifiedSource: [],
                        allocUnspecifiedSourceType: [],
                        allocMissingFiscalYear: [],
                        allocMultipleFiscalYears: [],
                        allocUsFws: [],
                        duplicateContactName: [],
                        responsiblePartyInvalidRole: [],
                        resourceTypeInvalid: []
                    });
                }
            })
            .then(results => {
                const lccIds = results.results.map(r => r._id);
                return Lcc.find({_id:{$in:lccIds}})
                    .sort('title')
                    .then(lccs => {
                        const lccMap = lccs.reduce((map,lcc) => {
                            map[lcc._id.toString()] = lcc.title;
                            return map;
                        },{});
                        const issuesInfo = [{
                                key: 'allocUnspecifiedRecipient',
                                title: 'Allocation with unspecified recipient'
                            },{
                                key: 'allocUnspecifiedRecipientType',
                                title: 'Allocation with recipient with unspecified contactType'
                            },{
                                key: 'allocUnspecifiedSource',
                                title: 'Allocation with unspecified source'
                            },{
                                key: 'allocUnspecifiedSourceType',
                                title: 'Allocation with source with unspecified contactType'
                            },{
                                key: 'allocMissingFiscalYear',
                                title: 'Allocation with no fiscal years identified'
                            },{
                                key: 'allocMultipleFiscalYears',
                                title: 'Allocation has a timePeriod spanning multiple fiscal years'
                            },{
                                key: 'allocUsFws',
                                title: 'Funding source should be "U.S. Fish and Wildlife Service"'
                            },{
                                key: 'duplicateContactName',
                                title: 'Duplicate contact name'
                            },{
                                key: 'responsiblePartyInvalidRole',
                                title: 'A responsible party has an invalid role (<a href="https://mdtools.adiwg.org/#codes-page?c=iso_role" target="_blank">valid roles</a>)'
                            },{
                                key: 'resourceTypeInvalid',
                                title: 'An invalid resource type has been specified (<a href="https://mdtools.adiwg.org/#codes-page?c=iso_scope" target="_blank">valid types</a>)'
                            }];
                        let html = '<h1>Science-Catalog QA/QC Issues</h1>';
                        html += `<ul>`;
                        html += Object.keys(lccMap).map(lccId => `<li><a href="#${lccId}">${lccMap[lccId]}</a></li>`).join('');
                        html += `</ul><hr />`;
                        html = results.results.reduce((html,result) => {
                                const issues = result.value;
                                html += `<h2 id="${result._id}">${lccMap[result._id]}</h2>`;
                                issuesInfo.forEach(info => {
                                    const issueInfo = issues[info.key];
                                    if(issueInfo.length) {
                                        html += `<h3>${info.title}</h3>`;
                                        html += `<ul>`;
                                        html += issueInfo.map(ii => {
                                                let info = '<li>';
                                                info += `<a target="_blank" href="https://www.sciencebase.gov/catalog/item/${ii._id}">${ii._id}</a>`;
                                                if(ii.lccnet) { // this assumes being accessed through lccnetwork site.
                                                    info += `  (<a target="_blank" href="${ii.lccnet.url}">catalog item</a>)`;
                                                }
                                                if(ii.info && ii.info.length) {
                                                    info += ` [${ii.info.map(s => `"${s}"`).join(', ')}]`;
                                                }
                                                info += '</li>';
                                                return info;
                                            }).join('');
                                        html += `</ul>`;
                                    }
                                });
                                html += '<hr />';
                                return html;
                            },html);
                        res.send(html);
                    });
            })
            .catch(err => Resource.sendError(res,500,'qaqcIssues',err));
        });

        item.staticLink('summaryStatistics',function(req,res) {
            const query = this._distinctQuery(req);
            item.getModel().mapReduce({
                query: query,
                map: function() {
                    let doc = this as ItemDoc,
                        simplified = doc.simplified,
                        stats:any = { // has to be cut/paste because this code runs IN the db
                            totalFunds: 0,
                            projectCount: 0,
                            productCount: 0,

                            projectsByProjectCategory: null,
                            productsByResourceType: null,

                            agencyFundsTotal: 0,
                            agencyFundsSourceCount: 0,
                            agencyFundsRecipientCount: 0,
                            agencyFundsBySourceType: null,
                            agencyFundsByRecipientType: null,
                            agencyFundsByFiscalYear: null,

                            matchingFundsTotal: 0,
                            matchingFundsSourceCount: 0,
                            matchingFundsRecipientCount: 0,
                            matchingFundsBySourceType: null,
                            matchingFundsByRecipientType: null,
                            matchingFundsByFiscalYear: null,

                            uniqueCollaboratorsByOrgType: null,
                        },
                        contactMap = simplified.contacts.reduce((map,c) => {
                                map[c.contactId] = c;
                                return map;
                            },{});
                    if(simplified.funding) {
                        stats.totalFunds += simplified.funding.amount;
                        if(simplified.funding.allocations) {
                            const matching = simplified.funding.allocations.matching||[],
                                  nonMatching = simplified.funding.allocations.nonMatching||[];
                            const mapAllocationsByContactType = (arr,contactKey) => {
                                        return arr.reduce((map,a) => {
                                            const c = a[contactKey],
                                                  contactType = c ? c.contactType||`unspecified ${contactKey} type` : `unspecified ${contactKey}`;
                                            map[contactType] = map[contactType]||0;
                                            map[contactType] += a.amount;
                                            return map;
                                        },{});
                                    },
                                    sumAllocations = (arr) => arr.reduce((sum,a) => sum+(a.amount||0), 0),
                                    sumByFiscalYear = (arr) => arr.reduce((map,a) => {
                                        const fiscalYear = a.fiscalYears & a.fiscalYears.length ?
                                            // there should only be one but if there are N then use the first year (last in array
                                            // since they are sorted largest to smallest)
                                            a.fiscalYears[a.fiscalYears.length-1] :
                                            999, // unspecified
                                            key = `${fiscalYear}`;
                                        map[key] = map[key]||0;
                                        map[key] += a.amount;
                                        return map;
                                    },{}),
                                    fundsSRNames = (input,contactKey) => input.reduce((arr,a) => {
                                            // using name here because we want unique orgs over all items
                                            // and orgs will NOT share a common id from item to items
                                            // BUT contacts have been normalized so names should match
                                            if(a[contactKey] && arr.indexOf(a[contactKey].name) === -1) {
                                                arr.push(a[contactKey].name);
                                            }
                                            return arr;
                                        },[]);

                            stats.agencyFundsBySourceType = mapAllocationsByContactType(nonMatching,'source');
                            stats.agencyFundsByRecipientType = mapAllocationsByContactType(nonMatching,'recipient');
                            stats.agencyFundsByFiscalYear = sumByFiscalYear(nonMatching);
                            stats.agencyFundsTotal = sumAllocations(nonMatching);
                            stats.agencyFundsSourceCount = fundsSRNames(nonMatching,'source');
                            stats.agencyFundsRecipientCount = fundsSRNames(nonMatching,'recipient');

                            stats.matchingFundsBySourceType = mapAllocationsByContactType(matching,'source');
                            stats.matchingFundsByRecipientType = mapAllocationsByContactType(matching,'recipient');
                            stats.matchingFundsByFiscalYear = sumByFiscalYear(matching);
                            stats.matchingFundsTotal = sumAllocations(matching);
                            stats.matchingFundsSourceCount = fundsSRNames(matching,'source');
                            stats.matchingFundsRecipientCount = fundsSRNames(matching,'recipient');
                        }
                    }
                    stats.uniqueCollaboratorsByOrgType = simplified.contacts.reduce((map,c) => {
                            let t = c.contactType||'Unspecified contact type';
                            map[t] = map[t]||[];
                            if(map[t].indexOf(c.name) === -1) {
                                map[t].push(c.name);
                            }
                            return map;
                        },{});
                    if(doc.scType === 'project') {
                        stats.projectsByProjectCategory = ((simplified.keywords.keywords||{}).lcc_project_category||[]).reduce((map,pc) => {
                                map[pc] = 1;
                                return map;
                            },{});
                    } else {
                        stats.productsByResourceType = (simplified.resourceType||[]).reduce((map,rt) => {
                                map[rt.type] = 1;
                                return map;
                            },{});
                    }
                    stats[doc.scType === 'project' ? 'projectCount' : 'productCount'] = 1;
                    emit('stats',stats);
                },
                reduce: function(key,values:any[]) {
                    let stats = values.reduce((stats,v) => {
                            stats.totalFunds += v.totalFunds;

                            stats.projectCount += v.projectCount;
                            stats.productCount += v.productCount;
                            let sumMap = (key) => {
                                    let vMap = v[key];
                                    if(vMap) {
                                        stats[key] = Object.keys(vMap).reduce((map,key) => {
                                                map[key] = map[key]||0;
                                                map[key] += vMap[key];
                                                return map;
                                            },(stats[key]||{}));
                                    }
                                };

                            stats.agencyFundsTotal += v.agencyFundsTotal;
                            sumMap('agencyFundsBySourceType');
                            sumMap('agencyFundsByRecipientType');
                            sumMap('agencyFundsByFiscalYear');

                            stats.matchingFundsTotal += v.matchingFundsTotal;
                            sumMap('matchingFundsBySourceType');
                            sumMap('matchingFundsByRecipientType');
                            sumMap('matchingFundsByFiscalYear');

                            sumMap('projectsByProjectCategory');
                            sumMap('productsByResourceType');

                            const collapseFundsSet = (key) => {
                                if(v[key]) {
                                    stats[key] = stats[key]||[];
                                    v[key].forEach(o => {
                                        if(stats[key].indexOf(o) === -1) {
                                            stats[key].push(o);
                                        }
                                    });
                                }
                            };
                            collapseFundsSet('matchingFundsSourceCount');
                            collapseFundsSet('matchingFundsRecipientCount');
                            collapseFundsSet('agencyFundsSourceCount');
                            collapseFundsSet('agencyFundsRecipientCount');
                            if(v.uniqueCollaboratorsByOrgType) {
                                stats.uniqueCollaboratorsByOrgType = Object.keys(v.uniqueCollaboratorsByOrgType).reduce((map,key) => {
                                        map[key] = map[key]||[];
                                        v.uniqueCollaboratorsByOrgType[key].forEach(o => {
                                            if(map[key].indexOf(o) === -1) {
                                                map[key].push(o);
                                            }
                                        });
                                        return map;
                                    },(stats.uniqueCollaboratorsByOrgType||{}))
                            }
                            return stats;
                        },{
                            totalFunds: 0,
                            projectCount: 0,
                            productCount: 0,

                            projectsByProjectCategory: null,
                            productsByResourceType: null,

                            agencyFundsTotal: 0,
                            agencyFundsSourceCount: 0,
                            agencyFundsRecipientCount: 0,
                            agencyFundsBySourceType: null,
                            agencyFundsByRecipientType: null,
                            agencyFundsByFiscalYear: null,

                            matchingFundsTotal: 0,
                            matchingFundsSourceCount: 0,
                            matchingFundsRecipientCount: 0,
                            matchingFundsBySourceType: null,
                            matchingFundsByRecipientType: null,
                            matchingFundsByFiscalYear: null,

                            uniqueCollaboratorsByOrgType: null,
                        });
                    return stats;
                }
            })
            .then(results => {
                console.log(`summaryStatistics:stats`,JSON.stringify(results.stats,null,2));
                if(!results.results.length) {
                    return res.send({
                        totalFunds: 0,
                        projectCount: 0,
                        productCount: 0,

                        projectsByProjectCategory: null,
                        productsByResourceType: null,

                        agencyFundsTotal: 0,
                        agencyFundsSourceCount: 0,
                        agencyFundsRecipientCount: 0,
                        agencyFundsBySourceType: null,
                        agencyFundsByRecipientType: null,
                        agencyFundsByFiscalYear: null,

                        matchingFundsTotal: 0,
                        matchingFundsSourceCount: 0,
                        matchingFundsRecipientCount: 0,
                        matchingFundsBySourceType: null,
                        matchingFundsByRecipientType: null,
                        matchingFundsByFiscalYear: null,

                        uniqueCollaboratorsByOrgType: null,
                    });
                }
                // collapse "unique" arrays/maps into numbers
                let stats = results.results[0].value,
                    mapToArray = (key) => {
                        if(stats[key]) {
                            let arr = Object.keys(stats[key]).reduce((arr,k) => {
                                    arr.push({
                                        key: k,
                                        value: stats[key][k]
                                    });
                                    return arr;
                                },[]);
                            stats[key] = arr.length ? arr.sort((a,b) => a.key.localeCompare(b.key)) : null;
                        }
                    };
                stats.matchingFundsSourceCount = stats.matchingFundsSourceCount ? stats.matchingFundsSourceCount.length : 0;
                stats.matchingFundsRecipientCount = stats.matchingFundsRecipientCount ? stats.matchingFundsRecipientCount.length : 0;
                stats.agencyFundsSourceCount = stats.agencyFundsSourceCount ? stats.agencyFundsSourceCount.length : 0;
                stats.agencyFundsRecipientCount = stats.agencyFundsRecipientCount ? stats.agencyFundsRecipientCount.length : 0;
                if(stats.uniqueCollaboratorsByOrgType) {
                    Object.keys(stats.uniqueCollaboratorsByOrgType)
                        .forEach(key => stats.uniqueCollaboratorsByOrgType[key] = stats.uniqueCollaboratorsByOrgType[key].length);
                }
                // map keys are unknown so will be easier for the client to
                // deal with arrays
                Object.keys(stats).forEach(key => {
                    if(stats[key] && typeof(stats[key]) === 'object') {
                        mapToArray(key);
                    }
                })
                res.send(stats)
            })
            .catch(err => Resource.sendError(res,500,'summaryStatistics',err));
        });

        item.staticLink('fwsFunding', function(req,res) {
            const FWS_FUNDING_SOURCES = [
                'Aleutian Bering Sea Islands LCC',
                'Arctic Landscape Conservation Cooperative',
                'California Landscape Conservation Cooperative',
                'Fisheries and Ecological Services',
                'Great Northern Landscape Conservation Cooperative',
                'Gulf Coastal Plains and Ozarks Landscape Conservation Cooperative',
                'Kodiak National Wildlife Refuge',
                'Landscape Conservation Cooperative Network',
                'Landscape Conservation Cooperative Network, National Office',
                'Mary Mahaffy',
                'Migratory Bird Management',
                'Migratory Birds Program',
                'National Wildlife Refuge System',
                'North Atlantic Landscape Conservation Cooperative',
                'North Pacific LCC',
                'Northwest Boreal Landscape Conservation Cooperative',
                'NWRS Division of Realty and Natural Resources',
                'Office of Science Applications',
                'Pacific Islands Landscape Conservation Cooperative',
                'Peninsular Florida Landscape Conservation Cooperative',
                'Science Applications - Region 4',
                'Selawik National Wildlife Refuge',
                'Togiak National Wildlife Refuge',
                'U.S. Fish and Wildlife Service',
                'US Fish & Wildife Service',
                'US Fish and Wildlife Service (Reg 7)',
                'Western Alaska Landscape Conservation Cooperative',
                'Yukon Delta National Wildlife Refuge',
            ];
            const model = this.getModel();
            model.mapReduce({
                query: model.find({'simplified.funding.sources.name': {$in:FWS_FUNDING_SOURCES}}),
                map: function() {
                    // this has to be copied into the map/reduce logic because it's executed in Mongo
                    const sources = [
                        'Aleutian Bering Sea Islands LCC',
                        'Arctic Landscape Conservation Cooperative',
                        'California Landscape Conservation Cooperative',
                        'Fisheries and Ecological Services',
                        'Great Northern Landscape Conservation Cooperative',
                        'Gulf Coastal Plains and Ozarks Landscape Conservation Cooperative',
                        'Kodiak National Wildlife Refuge',
                        'Landscape Conservation Cooperative Network',
                        'Landscape Conservation Cooperative Network, National Office',
                        'Mary Mahaffy',
                        'Migratory Bird Management',
                        'Migratory Birds Program',
                        'National Wildlife Refuge System',
                        'North Atlantic Landscape Conservation Cooperative',
                        'North Pacific LCC',
                        'Northwest Boreal Landscape Conservation Cooperative',
                        'NWRS Division of Realty and Natural Resources',
                        'Office of Science Applications',
                        'Pacific Islands Landscape Conservation Cooperative',
                        'Peninsular Florida Landscape Conservation Cooperative',
                        'Science Applications - Region 4',
                        'Selawik National Wildlife Refuge',
                        'Togiak National Wildlife Refuge',
                        'U.S. Fish and Wildlife Service',
                        'US Fish & Wildife Service',
                        'US Fish and Wildlife Service (Reg 7)',
                        'Western Alaska Landscape Conservation Cooperative',
                        'Yukon Delta National Wildlife Refuge',
                    ];
                    const doc = this;// as ItemDoc;
                    const allocations = []
                        .concat(doc.simplified.funding.allocations.nonMatching||[])
                        .concat(doc.simplified.funding.allocations.matching||[]);
                    const emits = {};
                   allocations.forEach(a => {
                       if(a.amount && a.source && a.source.name && sources.indexOf(a.source.name) !== -1) {
                           emits[a.source.name] = emits[a.source.name]||{
                            projects: 1,
                            allocations: 0,
                            total: 0
                           };
                           emits[a.source.name].allocations += 1;
                           emits[a.source.name].total += a.amount;
                       }
                    });
                   Object.keys(emits).forEach(key => emit(key,emits[key]));
                },
                reduce: function(key,values:any[]) {
                    return values.reduce((sum,last) => {
                        sum.projects += last.projects;
                        sum.allocations += last.allocations;
                        sum.total += last.total;
                        return sum;
                    },{
                        projects: 0,
                        allocations: 0,
                        total: 0
                    });
                }
            })
            .then(results => {
                //console.log('results',results);
                //res.send(results);
                let html = '<h1>FWS Funding Allocation Sources</h1>';
                const formatCommas = x => x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                const formatDollars = x => `$${formatCommas(x.toFixed(2))}`;
                const row = (label,allocations,projects,amount) => {
                    html += '<div class="lcc-row">';
                    html += `<div class="lcc-label">${label} [${formatCommas(allocations)} allocations/${formatCommas(projects)} projects]</div>`;
                    html += '<div class="ellipsis"></div>';
                    html += `<div class="lcc-total">${formatDollars(amount)}</div>`
                    html += '</div>';
                };
                html += `
                <style>
                .lcc-row {
                    display: flex;
                    align-items: baseline;
                }
                .ellipsis {
                    flex-grow: 1;
                    border-bottom: 2px dotted #aaa;
                    margin: 0px 10px;
                }
                .separator {
                    border-bottom: 1px solid #aaa;
                    margin: 5px 0px;
                }
                </style>
                `;
                results.results.forEach(r => row(r._id,r.value.allocations,r.value.projects,r.value.total));
                html += '<div class="separator"></div>';
                row(
                    'Total',
                    results.results.reduce((sum,r) => sum+r.value.allocations,0),
                    results.results.reduce((sum,r) => sum+r.value.projects,0),
                    results.results.reduce((sum,r) => sum+r.value.total,0),
                );
                res.send(html)
            })
            .catch(err => Resource.sendError(res,500,'fwsFunding',err));
        });

        let lcc = new Resource({...READONLY,...{
            rel: `${BASE_API_URI}/lcc`,
            model: Lcc,
            count: true
        }})
        .instanceLink('items',{
            otherSide: item,
            key: '_lcc'
        });

        let pipeline = new Resource({...READONLY,...{
            rel: `${BASE_API_URI}/pipeline`,
            model:SyncPipelineProcessorEntry
        }});

        item.initRouter(this.express);
        lcc.initRouter(this.express);
        pipeline.initRouter(this.express);

        // TODO remove?
        let log = new Resource({...READONLY,...{
            rel: `${BASE_API_URI}/log`,
            model: SyncPipelineProcessorLog,
            count: true,
            $top: 5,
        }});
        log.initRouter(this.express);
    }
}

export default new Server().express;
