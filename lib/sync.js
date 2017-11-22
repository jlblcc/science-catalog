let Project = require('../db/models/Project'),
    debug = require('debug')('sync'),
    chalk = require('chalk'),
    ObjectId = require('mongodb').ObjectId,
    request = require('request-promise-native');

module.exports = {
    /**
     * Given a Sciencebase item syncs it into mongo.  Will return null
     * rather than a promise if the item is not suitable for import (e.g. does
     * not have associated mdJson).
     *
     * If the item is suitable for import a Promise will be returned that Will
     * resolve when the project has been imported successfully to mongo and
     * rejected if any errors happen.
     *
     * @return Promise or null.
     */
    importSbProject: function(item) {
        let mdJsonUrl = item.files ? item.files.reduce((found,f) => {
                return found||(f.name === 'md_metadata.json' ? f.url : undefined);
            },undefined) : undefined;
        if(!mdJsonUrl) { // project not suitable for import
            console.warn(chalk.red(`\tWARNING: item with title "${item.title}" does not have attached mdJson`));
            return null;
        }
        console.log(`\tSyncing ${item.title}`);
        return new Promise((resolve,reject) => {
            request(mdJsonUrl)
                .then((json => {
                    let insert = {
                        _id: new ObjectId(item.id),
                        title: item.title,
                        mdJson: JSON.parse(json)
                    };
                    // upsert
                    Project.findOneAndUpdate({
                        _id: insert._id
                    },insert,{upsert:true},(err,o) => {
                        if(err){
                            return reject(err);
                        }
                        resolve(o);
                    });
                }))
                .catch(reject);
        });
    }
};
