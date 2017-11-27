let express = require('express')
    Resource = require('odata-resource'),
    app = express(),
    db = require('./db')
    fundingReport = require('./lib/fundingReport');

app.use(require('body-parser').json());

app.get('/',(req,res) => {
    res.send('science catalog api');
});

let project = new Resource({
    rel: '/api/project',
    model: require('./db/models/Project'),
    // query arg defaults
    $top: 5,
    $orderby: 'title',
    $orderbyPaged: 'title'
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

project.staticLink('funding_report',fundingReport(project));

let lcc = new Resource({
    rel: '/api/lcc',
    model: require('./db/models/Lcc')
})
.instanceLink('projects',{
    otherSide: project,
    key: '_lcc'
});

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
