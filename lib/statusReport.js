let Resource = require('odata-resource');

module.exports = function(resource,matchGenerator) {
    return function(req,res) {
        (matchGenerator ? matchGenerator(req) : Promise.resolve()).then((match) => {
            let pipeline = [];
            if(match) {
                pipeline.push({$match: match});
            }
            pipeline.push({$unwind: "$mdJson.metadata.resourceInfo.status"});
            pipeline.push({
                $group: { _id: "$mdJson.metadata.resourceInfo.status", count: { $sum : 1}}
            });
            resource.getModel().aggregate(pipeline,function(err,counts) {
                if(err) {
                    return Resource.sendError(res,500,'Error performing status aggregation',err);
                }
                res.send(counts.reduce((map,o) => {
                    map[o._id] = o.count;
                    return map;
                },{}));
            });
        });
    };
};
