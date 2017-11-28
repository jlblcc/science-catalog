let express = require('express')
    Resource = require('odata-resource'),
    app = express(),
    db = require('./db')
    fundingReport = require('./lib/fundingReport'),
    keywordReport = require('./lib/keywordReport');

app.use(require('body-parser').json());

app.use(express.static('app'));
/*
app.get('/',(req,res) => {
    res.send('science catalog api');
});*/

let project = new Resource({
    rel: '/api/project',
    model: require('./db/models/Project'),
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

project.staticLink('vocabularies',keywordReport.vocabularyReport(project));
project.staticLink('keyword_types',keywordReport.keywordTypeReport(project));
project.staticLink('keywords',keywordReport.report(project));
Object.keys(keywordReport.VOCABULARIES).forEach(vocab_key => {
    project.staticLink(vocab_key,keywordReport.report(project,keywordReport.vocabularyQueryGenerator(vocab_key)));
});
project.staticLink('funding_report',fundingReport(project));

let lcc = new Resource({
    rel: '/api/lcc',
    model: require('./db/models/Lcc'),
    count: true
})
.instanceLink('projects',{
    otherSide: project,
    key: '_lcc'
});
// replace find to add project counts
// only works for find, not any of the item based responses.
lcc.find = function(req,res) {
    var self = this,
        def = this.getDefinition(),
        query = this.initQuery(self.getModel().find(),req);
    query.exec(function(err,objs){
        if(err){
            Resource.sendError(res,500,'find failed',err);
        } else {
            project.getModel().aggregate([
                {$match: { _lcc: {$in: objs.map(o => o._id)}}},
                {$group: { _id: "$_lcc", count: {$sum : 1}}}
            ],function(err,result){
                let counts = result.reduce((map,item) => {
                    map[item._id] = item.count;
                    return map;
                },{});
                self._findListResponse(req,res,objs.map(o => {
                    o.projectCount = counts[o._id];
                    return o;
                }));
            })
        }
    });
};

lcc.instanceLink('funding_report',fundingReport(project,(req) => {
    return new Promise((resolve,reject) => {
        lcc.getModel().findById(req._resourceId).exec((err,obj) => {
            if(err) {
                return reject(err);
            }
            resolve({_lcc: obj._id});
        });
    });
}));


project.initRouter(app);
lcc.initRouter(app);

db().then(() => {
        let server = app.listen(8989,() => {
            console.log(`listening on ${server.address().port}`)
        });
    }).catch(e => {
        console.error(e);
        process.exit(1);
    });
