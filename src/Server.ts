import * as express from 'express';

import Resource = require('odata-resource');
import * as BodyParser from 'body-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as truncateHtml from 'truncate-html';

import { Request, Response } from 'express';
import { DocumentQuery } from 'mongoose';

import { ObjectId } from 'mongodb';

import { Item, ItemDoc, SimplifiedIfc,
         Lcc,
        SyncPipelineProcessorLog } from './db/models';

import { BASE_URI, BASE_API_URI } from './uris';

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
    private _distinctQuery(req:Request) {
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
            query.populate('_products','simplified');
            query.populate('_project','simplified');
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

        item.staticLink('summaryStatistics',function(req,res) {
            const query = this._distinctQuery(req);
            item.getModel().mapReduce({
                query: query,
                map: function() {
                    let doc = this as ItemDoc,
                        simplified = doc.simplified,
                        stats:any = {
                            fundingTotal: 0,
                            fundsBySourceType: null,
                            fundsByRecipientType: null, // TODO by year
                            matchingContributionsByOrgType: null, // TODO by year
                            orgsProvidingInKindMatch: 0,
                            projectsByResourceType: null,
                            productsByResourceType: null,
                            uniqueCollaboratorsByOrgType: null,
                            projectsInLastMonth: 0,
                            productsInLastMonth: 0,
                        },
                        contactMap = simplified.contacts.reduce((map,c) => {
                                map[c.contactId] = c;
                                return map;
                            },{});
                    if(simplified.funding) {
                        stats.fundingTotal += simplified.funding.amount;
                        let allocations = doc.mdJson.metadata.funding.reduce((arr,f) => {
                                    (f.allocation||[]).forEach(a => arr.push(a));
                                    return arr;
                                },[]),
                            matchingAllocations = allocations.filter(a => a.matching),
                            mapAllocationsByContactType = (arr,key) => {
                                return arr.reduce((map,a) => {
                                        let c;
                                        if(a[key] && (c = contactMap[a[key]])) {
                                            let t = c.contactType||'?';
                                            map[t] = map[t]||0;
                                            map[t] += a.amount;
                                        }
                                        return map;
                                    },{});
                            };
                        stats.fundsBySourceType = mapAllocationsByContactType(allocations,'sourceId');
                        stats.fundsByRecipientType = mapAllocationsByContactType(allocations,'recipientId');
                        if(matchingAllocations.length) {
                            stats.matchingContributionsByOrgType = mapAllocationsByContactType(matchingAllocations,'sourceId');
                            stats.orgsProvidingInKindMatch = matchingAllocations.reduce((arr,a) => {
                                    let c;
                                    if(a.sourceId && (c = contactMap[a.sourceId]) && arr.indexOf(c.name) === -1) {
                                        arr.push(c.name);
                                    }
                                    return arr;
                                },[]);
                        }
                    }
                    stats.uniqueCollaboratorsByOrgType = simplified.contacts.reduce((map,c) => {
                            let t = c.contactType||'?';
                            map[t] = map[t]||[];
                            if(map[t].indexOf(c.name) === -1) {
                                map[t].push(c.name);
                            }
                            return map;
                        },{});
                    stats[doc.scType === 'project' ? 'projectsByResourceType' : 'productsByResourceType']
                        = simplified.resourceType.reduce((map,rt) => {
                                map[rt.type] = 1;
                                return map;
                            },{});
                    if(simplified.dates && simplified.dates.creation) {
                        let now = Date.now(),
                            oneMonth = 30*24*60*60*1000;
                        if((now - simplified.dates.creation.getTime()) < oneMonth) {
                            stats[doc.scType === 'project' ? 'projectsInLastMonth' : 'productsInLastMonth'] = 1;
                        }
                    }
                    emit('stats',stats);
                },
                reduce: function(key,values:any[]) {
                    let stats = values.reduce((stats,v) => {
                            stats.fundingTotal += v.fundingTotal;
                            stats.projectsInLastMonth += v.projectsInLastMonth;
                            stats.productsInLastMonth += v.productsInLastMonth;
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
                            sumMap('fundsBySourceType');
                            sumMap('fundsByRecipientType');
                            sumMap('matchingContributionsByOrgType');
                            sumMap('projectsByResourceType');
                            sumMap('productsByResourceType');
                            if(v.orgsProvidingInKindMatch) {
                                stats.orgsProvidingInKindMatch = stats.orgsProvidingInKindMatch||[];
                                v.orgsProvidingInKindMatch.forEach(o => {
                                    if(stats.orgsProvidingInKindMatch.indexOf(o) === -1) {
                                        stats.orgsProvidingInKindMatch.push(o);
                                    }
                                });
                            }
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
                            fundingTotal: 0,
                            fundsBySourceType: null,
                            fundsByRecipientType: null,
                            matchingContributionsByOrgType: null,
                            orgsProvidingInKindMatch: 0,
                            projectsByResourceType: null,
                            productsByResourceType: null,
                            uniqueCollaboratorsByOrgType: null,
                            projectsInLastMonth: 0,
                            productsInLastMonth: 0,
                        });
                    return stats;
                }
            })
            .then(results => {
                console.log(`summaryStatistics:stats`,JSON.stringify(results.stats,null,2));
                if(!results.results.length) {
                    return res.send({
                        fundingTotal: 0,
                        fundsBySourceType: null,
                        fundsByRecipientType: null,
                        matchingContributionsByOrgType: null,
                        orgsProvidingInKindMatch: 0,
                        projectsByResourceType: null,
                        productsByResourceType: null,
                        uniqueCollaboratorsByOrgType: null,
                        projectsInLastMonth: 0,
                        productsInLastMonth: 0,
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
                stats.orgsProvidingInKindMatch = stats.orgsProvidingInKindMatch ? stats.orgsProvidingInKindMatch.length : 0;
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

        let lcc = new Resource({...READONLY,...{
            rel: `${BASE_API_URI}/lcc`,
            model: Lcc,
            count: true
        }})
        .instanceLink('items',{
            otherSide: item,
            key: '_lcc'
        });

        item.initRouter(this.express);
        lcc.initRouter(this.express);

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
