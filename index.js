let express = require('express')
    Resource = require('odata-resource'),
    ObjectId = require('mongodb').ObjectId,
    app = express(),
    db = require('./db')
    fundingReport = require('./lib/fundingReport'),
    keywordReport = require('./lib/keywordReport'),
    statusReport = require('./lib/statusReport');

app.use(require('body-parser').json());

app.use(express.static('app'));

let item = new Resource({
    rel: '/api/item',
    model: require('./db/models/Item'),
    // query arg defaults
    $top: 5,
    $orderby: 'title',
    $orderbyPaged: 'title',
    count: true
})
.instanceLink('lcc',function(req,res) {
    this.getModel().findById(req._resourceId).exec((err,obj) => {
        if(err || !obj) {
            return Resource.sendError(res,404,'not found',err);
        }
        lcc.getModel().findById(obj._lcc).exec((err,lcc_obj) => {
            if(err || !lcc_obj) {
                return Resource.sendError(res,404,'not found',err);
            }
            lcc.singleResponse(req,res,lcc_obj);
        });
    });
});

item.staticLink('vocabularies',keywordReport.vocabularyReport(item));
item.staticLink('keyword_types',keywordReport.keywordTypeReport(item));
item.staticLink('contact_types',function(req,res) {
    this.getModel().distinct('mdJson.contact.contactType',function(err,types){
        if(err) {
            return Resource.sendError(res,500,'error getting contact types',err);
        }
        res.send(types);
    });
})
/*
item.staticLink('keywords',keywordReport.report(item));
Object.keys(keywordReport.VOCABULARIES).forEach(vocab_key => {
    item.staticLink(vocab_key,keywordReport.report(item,keywordReport.vocabularyQueryGenerator(vocab_key)));
});
*/
item.staticLink('keywords',keywordReport.simpleReport(item));
Object.keys(keywordReport.SIMPLE_VOCABULARIES).forEach(vocab_key => {
    item.staticLink(vocab_key,keywordReport.simpleReport(item,keywordReport.SIMPLE_VOCABULARIES[vocab_key]));
});
item.staticLink('funding_report',fundingReport(item));
item.staticLink('status_report',statusReport(item));
item.staticLink('resource_types',function(req,res){
    this.getModel().distinct('mdJson.metadata.resourceInfo.resourceType.type',function(err,types){
        if(err){
            return Resource.sendError(res,500,'error getting types',err);
        }
        res.send(types);
    });
});

let lcc = new Resource({
    rel: '/api/lcc',
    model: require('./db/models/Lcc'),
    count: true
})
.instanceLink('items',{
    otherSide: item,
    key: '_lcc'
});
// replace find to add item counts
// only works for find, not any of the item based responses.
lcc.find = function(req,res) {
    var self = this,
        def = this.getDefinition(),
        query = this.initQuery(self.getModel().find(),req);
    query.exec(function(err,objs){
        if(err){
            Resource.sendError(res,500,'find failed',err);
        } else {
            item.getModel().aggregate([
                {$match: { _lcc: {$in: objs.map(o => o._id)}}},
                {$group: { _id: "$_lcc", count: {$sum : 1}}}
            ],function(err,result){
                let counts = result.reduce((map,item) => {
                    map[item._id] = item.count;
                    return map;
                },{});
                self._findListResponse(req,res,objs.map(o => {
                    o.itemCount = counts[o._id];
                    return o;
                }));
            })
        }
    });
};

lcc.instanceLink('item_funding_report',fundingReport(item,(req) => {
    return new Promise((resolve,reject) => {
        resolve({_lcc: new ObjectId(req._resourceId)});
    });
}));
lcc.instanceLink('item_status_report',statusReport(item,(req) => {
    return new Promise((resolve,reject) => {
        resolve({_lcc: new ObjectId(req._resourceId)});
    });
}));


item.initRouter(app);
lcc.initRouter(app);

db().then(() => {
        let server = app.listen(8989,() => {
            console.log(`listening on ${server.address().port}`)
        });
    }).catch(e => {
        console.error(e);
        process.exit(1);
    });
