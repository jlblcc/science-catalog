import * as express from 'express';
import * as Resource from 'odata-resource';
import * as BodyParser from 'body-parser';

import { ObjectId } from 'mongodb';

import { Item, Lcc } from './db/models';

/** Base resource configuration that disables POST,PUT and DELETE */
const READONLY = {
    create: false,
    update: false,
    delete: false
};

/**
 * The base express API server.
 */
export class Server {
    public express;

    constructor() {
        let app = this.express = express();
        //
        app.use(BodyParser.json());
        this.init();
    }

    /**
     * Initializes the resources.
     */
    private init() {
        let item = new Resource({...READONLY,...{
            rel: '/api/item',
            model: Item,
            // query arg defaults
            $top: 5,
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
