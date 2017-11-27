/**
 * Generates an odata-resource relationship function that examine's item funding allocation, etc.
 *
 * @param {Resource} fundedResource The resource (e.g. project or product).
 * @param {function} queryGenerator Afunction that will generate a query to narrow the list of items to consier in the report (optional).
 * @return {function} A function that generates a funding report for the given resource and query.
 */
module.exports = function(fundedResource,queryGenerator) {
    return function(req,res) {
        (queryGenerator ? queryGenerator(req) : Promise.resolve()).then((query) => {
            // functions run IN mongo so can't use constants, etc.
            // because of how contacts are referenced within their own documents
            // it feels like the aggregation pipeline is probably not an option here.
            fundedResource.getModel().mapReduce({
                query: query,
                map: function() {
                    let funding = this.mdJson.metadata.funding;
                    if(funding) {
                        let contactMap = (this.mdJson.contact||[]).reduce((map,c) => {
                            map[c.contactId] = c;
                            return map;
                        },{});
                        funding.forEach(f => {
                            (f.allocation||[]).forEach(a => {
                                let simplify = (c) => {
                                        return c ? {
                                            name: c.name,
                                            contactType: c.contactType
                                        } : undefined;
                                    },
                                    unknown = () => {
                                        return {
                                            name: '?',
                                            contactType: null
                                        };
                                    },
                                    sid = a.sourceId,
                                    rid = a.recipientId,
                                    c = sid ? simplify(contactMap[sid]) : unknown();
                                // just in case somehow sourceId is set but not listed
                                // among the contacts
                                if(!c) { c = unknown(); }
                                if(rid) {
                                    a.recipient = simplify(contactMap[rid]);
                                }
                                if(!a.recipient) { a.recipient = unknown(); }
                                // drop this info since it just bloats the response
                                delete a.sourceId;
                                delete a.recipientId;
                                emit(sid||'?', {
                                    contact: c,
                                    allocations: [a],
                                    total: a.amount
                                });
                            });
                        });
                    }
                },
                reduce: function(key,values) { // only called when there are n values
                    // using the first contact value assumes they are all equivalent which may not be true
                    return {
                        contact: values[0].contact,
                        allocations: values.map(v => v.allocations[0]),
                        total: Array.sum(values.map(v => v.total)) // assumes currency matches
                    };
                }
            },(err,sums) => {
                if(err) {
                    return Resource.sendError(res,500,'Error reducing funding',err);
                }
                res.send(sums);
            });
        }).catch(err => {
            Resource.sendError(res,500,'Error generating query.',err);
        });
    };
}
