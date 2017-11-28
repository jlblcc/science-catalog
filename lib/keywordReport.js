let Resource = require('odata-resource');

let service = {
    keywordTypeReport: function(resource) {
        return function(req,res) {
            resource.getModel().distinct('mdJson.metadata.resourceInfo.keyword.keywordType',function(err,vocabs) {
                if(err){
                    return Resource.sendError(res,500,'error getting vocabularies',err);
                }
                res.send(vocabs);
            });
        };
    },
    vocabularyReport: function(resource) {
        return function(req,res) {
            resource.getModel().distinct('mdJson.metadata.resourceInfo.keyword.thesaurus',function(err,vocabs) {
                if(err){
                    return Resource.sendError(res,500,'error getting vocabularies',err);
                }
                res.send(vocabs);
            });
        };
    },
    report: function(resource,queryGenerator) {
        return function(req,res) {
            (queryGenerator ? queryGenerator(req) : Promise.resolve({})).then(query => {
                resource.getModel().distinct('mdJson.metadata.resourceInfo.keyword.keyword.keyword',(query||{}),function(err,keywords){
                    if(err){
                        return Resource.sendError(res,500,'error getting keywords',err);
                    }
                    res.send(keywords);
                });
            });
        };
    },
    /* the "label" from keywordTypeReport appears to be oddly better than the uri like below
    VOCABULARIES: { // note onlineResource.uri is not unique, nor is much else about these "thesaurus" entries
        'keywords_project_category': 'https://www.sciencebase.gov/vocab/vocabulary/52dee7c5e4b0dee2a6cd6b18',
        'keywords_end_user_types': 'https://www.sciencebase.gov/vocab/vocabulary/54760ef9e4b0f62cb5dc41a0',
        'keywords_deliverable_types': 'https://www.sciencebase.gov/vocab/vocabulary/5307baa3e4b0dcc7bdc913a9'
    },
    vocabularyQueryGenerator: function(vocabulary_key) {
        return function() {
            return new Promise(resolve => {
                resolve({
                    'mdJson.metadata.resourceInfo.keyword.thesaurus.onlineResource.uri': service.VOCABULARIES[vocabulary_key]
                });
            });
        };
    }*/
    // the end result of the vocabularyReports aren't currently correct because the filter chooses projects
    // that match a given keywordType and then returns the distinct values for all keywords that project
    // uses, not just those of that given type...
    // probably need to use aggregation, or map/reduce rather than distinct
    VOCABULARIES: { // note onlineResource.uri is not unique, nor is much else about these "thesaurus" entries
        'keywords_project_category': 'LCC Project Category',
        'keywords_end_user_types': 'LCC End User Type',
        'keywords_deliverable_types': 'LCC Deliverable',
        'keywords_us_states': 'U.S. States'
    },
    vocabularyQueryGenerator: function(vocabulary_key) {
        return function() {
            return new Promise(resolve => {
                resolve({
                    'mdJson.metadata.resourceInfo.keyword.keywordType': service.VOCABULARIES[vocabulary_key]
                });
            });
        };
    }
}
module.exports = service;
