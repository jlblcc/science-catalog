let Lcc = require('../db/models/Lcc'),
    Project = require('../db/models/Project'),
    debug = require('debug')('sync'),
    chalk = require('chalk'),
    ObjectId = require('mongodb').ObjectId,
    request = require('request-promise-native');

const UPSERT_OPTIONS = {
    upsert: true,
    new: true
};

module.exports = {
    /**
     * Given a sciencebase id (pointer to LCC item in LCMAP) returns a Promise
     * that will sync that item into an Lcc in mongo.
     *
     * @return Promise
     */
    importSbLcc: function(id) {
        return new Promise((resolve,reject) => {
            request({
                    url: `https://www.sciencebase.gov/catalog/item/${id}`,
                    qs: {
                        format: 'json',
                        fields: 'title'
                    }
                })
                .then(json => {
                    let data = JSON.parse(json),
                        lcc = {
                            _id: new ObjectId(data.id),
                            title: data.title
                        };
                    Lcc.findOneAndUpdate({ _id: lcc._id},lcc,UPSERT_OPTIONS,(err,o) => {
                        if(err) {
                            return reject(err);
                        }
                        resolve(o);
                    });
                })
                .catch(reject);
        });
    },
    /**
     * Given a Sciencebase item syncs it into mongo.  Will return null
     * rather than a promise if the item is not suitable for import (e.g. does
     * not have associated mdJson).
     *
     * If the item is suitable for import a Promise will be returned that Will
     * resolve when the project has been imported successfully to mongo and
     * rejected if any errors happen.
     *
     * @param {object} lcc The parent LCC record.
     * @param {object} item The Sciencebase item.
     * @return Promise or null.
     */
    importSbProject: function(lcc,item) {
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
                        _lcc: lcc._id,
                        title: item.title,
                        mdJson: JSON.parse(json)
                    };
                    // upsert
                    Project.findOneAndUpdate({
                        _id: insert._id
                    },insert,UPSERT_OPTIONS,(err,o) => {
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
