let express = require('express')
    Resource = require('odata-resource'),
    app = express(),
    db = require('./db');

app.use(require('body-parser').json());

app.get('/',(req,res) => {
    res.send('science catalog api');
});

function fundingReport(fundedResource,queryGenerator) {
    return function(req,res) {
        (queryGenerator ? queryGenerator(req) : Promise.resolve()).then((query) => {
            // functions run IN mongo so can't use constants, etc.
            // TODO consider whether the aggregation framework might
            // not be better...
            fundedResource.getModel().mapReduce({
                query: query,
                map: function() {
                    let funding = this.mdJson.metadata.funding;
                    if(funding) {
                        funding.forEach(f => {
                            f.allocation.forEach(a => {
                                emit(a.sourceId||'?', {
                                    count: 1,
                                    values: [a.amount],
                                    total: a.amount
                                });
                            });
                        });
                    }
                },
                reduce: function(key,values) {
                    let nums = values.map(v => v.total);
                    return {
                        count: values.length,
                        values: nums,
                        total: Array.sum(nums)
                    };
                }
            },(err,sums) => {
                if(err) {
                    return Resource.sendError(res,500,'Error reducing funding',err);
                }
                let contactIds = sums.map(o => o._id).filter(id => id !== '?');
                fundedResource.getModel().find(Object.assign({},(query||{}),{'mdJson.contact.contactId': {$in: contactIds}}),'mdJson.contact',(err,objs) => {
                    if(err) {
                        return Resource.sendError(res,500,'Joining contacts',err);
                    }
                    let contacts = {};
                    objs.forEach(o => {
                        o.mdJson.contact.forEach(c => {
                            let idx = contactIds.indexOf(c.contactId);
                            if(idx !== -1) {
                                contacts[c.contactId] = c;
                                contactIds.splice(idx,1); // first one wins
                            }
                        });
                    });
                    res.send(sums.map(s => {
                        let c = contacts[s._id];
                        return {
                            donor: c ? c.name||s._id : s._id,
                            type: c ? c.contactType : undefined,
                            total: s.value
                        };
                    }));
                });
            });
        }).catch(err => {
            Resource.sendError(res,500,'Error generating query.',err);
        });
    };
}

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
