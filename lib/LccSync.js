let Lcc = require('../db/models/Lcc'),
    Item = require('../db/models/Item'),
    debug = require('debug')('LccSync'),
    chalk = require('chalk'),
    ObjectId = require('mongodb').ObjectId,
    request = require('request-promise-native'),
    crypto = require('crypto');

const UPSERT_OPTIONS = {
    upsert: true,
    new: true
};

class LccSync {

    /**
     * Creates an LccSync for a given sciencebase id.
     * E.g.
     * ```
     * (new LccSync(id)).quiet(true).sync()
     *   .then(err => {
     *      console.log(err);
     *      process.exit(0);
     *   })
     *   .catch(err => {
     *      console.error(err);
     *      process.exit(1);
     *   });
     * ```
     */
    constructor(sbid) {
        this.sbid = sbid;
        this.counts = {
            pages: 0,
            total: 0,
            ignored: 0,
            created: 0,
            updated: 0,
            unchanged: 0
        };
    }

    /**
     * Builder pattern accessor that sets a flag that tells the sync whether
     * or not to log to the console.  The default is to log.
     */
    quiet(_) {
        if(arguments.length) {
            this._quiet = _;
            return this;
        }
        return this._quiet;
    }

    force(_) {
        if(arguments.length) {
            this._force = _;
            return this;
        }
        return this._force;
    }

    /**
     * Builder pattern accessor for testing purposes a flag that will tell the
     * sync to randomly update the contents of mdJson files to validate that
     * sb side updates would properly apply.
     */
    randMod(_) {
        if(arguments.length) {
            this._randMod = _;
            return this;
        }
        return this._randMod;
    }

    /**
     * Syncs this lcc and all its projects.  Requires that the process is already
     * connected to the database.
     *
     * @return {Promise} resolved with this.counts, first error rejects.
     */
    sync() {
        this.counts.startMillis = (new Date()).getTime();
        return new Promise((resolve,reject) => {
            this._lccSync()
                .then(lcc => {
                    if(!this.quiet()) {
                        console.log(chalk.bgGreen(`Starting project sync for ${lcc.title}`));
                    }
                    this._syncProjects()
                        .then(resolve)
                        .catch(reject);
                })
                .catch(reject);
        });
    }

    /**
     * Syncs all projects for this lcc.
     *
     * @return {Promise}
     */
    _syncProjects() {
        return new Promise((resolve,reject) => {
            let importOnePage = (response) => {
                this.counts.pages++;
                if(!this.quiet()) {
                    console.log(chalk.bgBlue(`-- processing page # ${this.counts.pages}`));
                }
                response = JSON.parse(response);
                let next = () => {
                        if(response.nextlink && response.nextlink.url) {
                            request(response.nextlink.url).then(importOnePage).catch(reject);
                        } else {
                            this.counts.endMillis = (new Date()).getTime();
                            this.counts.timeSeconds = (this.counts.endMillis - this.counts.startMillis)/1000;
                            resolve(this.counts);
                        }
                    },
                    items = response.items,
                    promises = items.map(i => this._projectSync(i));
                this.counts.total += items.length;
                if(promises.length) {
                    // wait for them to complete
                    Promise.all(promises)
                        .then(next)
                        .catch(reject);
                } else {
                    next();
                }
            };
            // get the ball rolling
            request({
                    url: `https://www.sciencebase.gov/catalog/items`,
                    qs: {
                        fields: 'title,files',
                        filter0: `browseCategory=Project`,
                        filter1: 'tags=LCC Network Science Catalog',
                        filter2: `ancestors=${this.lcc._id}`,
                        sort: 'lastUpdated',
                        order: 'desc',
                        format: 'json',
                        max: 5 // how may to import at a time
                    }
                })
                .then(importOnePage)
                .catch(reject);
        });
    }

    /**
     * Sync's the LCC record.
     *
     * @return {Promise} resolved with the lcc object (this.lcc set upon resolution).
     */
    _lccSync() {
        return new Promise((resolve,reject) => {
            request({
                    url: `https://www.sciencebase.gov/catalog/item/${this.sbid}`,
                    qs: {
                        format: 'json',
                        fields: 'title'
                    }
                })
                .then(json => {
                    let data = JSON.parse(json),
                        lcc = {
                            _id: new ObjectId(data.id),
                            title: data.title,
                            lastSync: new Date()
                        };
                    Lcc.findOneAndUpdate({ _id: lcc._id},lcc,UPSERT_OPTIONS,(err,o) => {
                        if(err) {
                            return reject(err);
                        }
                        resolve(this.lcc = o);
                    });
                })
                .catch(reject);
        });
    }

    _simplify(mdJson) {
        let simplified = {
            title: mdJson.metadata.resourceInfo.citation.title,
            keywords: mdJson.metadata.resourceInfo.keyword.reduce((map,k) => {
                if(k.keywordType) {
                    let typeLabel = k.keywordType,
                        typeKey = typeLabel
                            .trim()
                            .toLowerCase()
                            .replace(/[\.-]/g,'')
                            .replace(/\s+/g,'_');
                    map.types[typeKey] = typeLabel;
                    map.keywords[typeKey] = map.keywords[typeKey]||[];
                    k.keyword.forEach(kw => map.keywords[typeKey].push(kw.keyword.trim()));
                }
                return map;
            },{
                types: {},
                keywords: {}
            })
        };
        return simplified;
    }

    /**
     * Syncs a single project.
     *
     * @param {Object} item A single Sciencebase project item.
     * @param {Promise}
     */
    _projectSync(item) {
        if(!this.lcc) {
            throw new Error('lcc net set');
        }

        return new Promise((resolve,reject) => {
            let mdJsonUrl = item.files ? item.files.reduce((found,f) => {
                    return found||(f.name === 'md_metadata.json' ? f.url : undefined);
                },undefined) : undefined;
            if(!mdJsonUrl) { // project not suitable for import
                this.counts.ignored++;
                if(!this.quiet()) {
                    console.warn(chalk.red(`\tWARNING: item ${item.id} with title "${item.title}" does not have attached mdJson`));
                }
                return resolve(null);
            }
            request(mdJsonUrl)
                .then((json => {
                    if(this.randMod()) {
                        // this is strictly for testing purposes ~25% of the time
                        // randomly change the title in the mdJson so that the
                        // hash should change and an update be applied.
                        if((Math.floor(Math.random()*100)+1) < 25) {
                            let tmp = JSON.parse(json),
                                title = tmp.metadata.resourceInfo.citation.title,
                                nowMillis = (new Date()).getTime();
                            item.title = tmp.metadata.resourceInfo.citation.title = `${title} (${nowMillis})`;
                            if(!this.quiet()) {
                                console.log(chalk.bgRed(`\tTESTING[${item.id}]: title modified to ${title}`));
                            }
                            json = JSON.stringify(tmp);
                        }
                    }
                    let sha1 = crypto.createHash('sha1'),
                        catalog_item,
                        mdJson = JSON.parse(json),
                        now = new Date();
                    sha1.update(json);
                    catalog_item = {
                        _id: new ObjectId(item.id),
                        _lcc: this.lcc._id,
                        title: item.title,
                        created: now,
                        modified: now,
                        hash: sha1.digest('hex'),
                        mdJson: mdJson,
                        simplified: this._simplify(mdJson)
                    };
                    Item.findById(catalog_item._id,(err,existing) => {
                        if(err) {
                            return reject(err);
                        }
                        if(this.force() || !existing || existing.hash !== catalog_item.hash) {
                            if(existing) {
                                // retain the original create stamp
                                catalog_item.created = existing.created;
                                if(!this.quiet()) {
                                    console.log(chalk.magenta(`\tUpdating[${item.id}]: ${item.title}`));
                                }
                            } else if(!this.quiet()){
                                console.log(chalk.green(`\tCreating[${item.id}]: ${item.title}`));
                            }
                            // TODO: sync with local and then only on success make the
                            // change in the catalog.
                            Item.findOneAndUpdate({
                                _id: catalog_item._id
                            },catalog_item,UPSERT_OPTIONS,(err,o) => {
                                if(err){
                                    return reject(err);
                                }
                                this.counts[existing ? 'updated' : 'created']++;
                                resolve(o);
                            });
                        } else {
                            if(!this.quiet()) {
                                console.log(chalk.cyan(`\tNo change[${item.id}]: ${item.title}`));
                            }
                            this.counts.unchanged++;
                            resolve(existing);
                        }
                    });
                }))
                .catch(reject);
        });
    }
}

module.exports = LccSync;
