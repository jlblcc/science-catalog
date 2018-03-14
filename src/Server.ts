import * as express from 'express';

import Resource = require('odata-resource');
import * as BodyParser from 'body-parser';
import * as path from 'path';
import * as truncateHtml from 'truncate-html';

import { Request, Response } from 'express';
import { DocumentQuery } from 'mongoose';

import { ObjectId } from 'mongodb';

import { Item, ItemDoc,
         Lcc } from './db/models';

/** Base resource configuration that disables POST,PUT and DELETE */
const READONLY = {
    create: false,
    update: false,
    delete: false
};

class ItemResource extends Resource<ItemDoc> {
    private _findQuery(req:Request) {
        let query = this.initQuery(this.getModel().find(),req);
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
        app.use(express.static(path.join(__dirname,'public')));
        app.get('/',(req,res) => res.redirect('/app'));
        this.init();
    }

    /**
     * Initializes the resources.
     */
    private init() {
        let item = new ItemResource({...READONLY,...{
            rel: '/api/item',
            model: Item,
            // query arg defaults
            $top: 25,
            $orderby: 'title',
            $orderbyPaged: 'title',
            count: true,
            //populate: ['_lcc']
        }});
        item.staticLink('distinct',(req,res) => {
            if(!req.query.$select) {
                return Resource.sendError(res,400,'Missing required parameter $select');
            }
            let query = item.getModel().find(),
                regex;
            if(req.query.$filter) {
                ItemResource.parseFilter(query,req.query.$filter);
            }
            if (req.query.$contains) {
                // this kind of duplicates with $filter could do BUT will trim
                // what distinct is run over and THEN further trim the resulting values
                // this is because distinct over an array of objects will return the whole
                // item which will almost certainly contain other hits within that array
                regex = new RegExp( req.query.$contains.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"));
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

        let lcc = new Resource({...READONLY,...{
            rel: '/api/lcc',
            model: Lcc,
            count: true
        }})
        .instanceLink('items',{
            otherSide: item,
            key: '_lcc'
        });

        item.initRouter(this.express);
        lcc.initRouter(this.express);
    }
}

export default new Server().express;
