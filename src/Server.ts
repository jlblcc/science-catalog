import * as express from 'express';

import Resource = require('odata-resource');
import * as BodyParser from 'body-parser';
import * as path from 'path';

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
    // override find and add parameter for $text (keyword) search
    find(req:Request,res:Response) {
        let query = this.initQuery(this.getModel().find(),req);
        if(req.query.$text) {
            query.and([{$text: {$search: req.query.$text}}]);
        }
        query.exec((err,items) => {
            if(err) {
                return Resource.sendError(res,500,`find failed`,err);
            }
            this._findListResponse(req,res,items,null);
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
        app.use(express.static(path.join(__dirname,'app')));
        app.use(BodyParser.json());
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
        }});

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
