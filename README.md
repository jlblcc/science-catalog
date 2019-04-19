
- [Application overview](#application-overview)
- [Database](#database)
  - [MongoDB](#mongodb)
  - [Data model](#data-model)
    - [Lcc](#lcc)
    - [Contact](#contact)
    - [Item](#item)
    - [SyncPipelineProcessorEntry](#syncpipelineprocessorentry)
    - [SyncPipelineProcessorLog](#syncpipelineprocessorlog)
- [Sync-pipeline](#sync-pipeline)
  - [Scripts](#scripts)
    - [lcc](#lcc)
    - [pipeline](#pipeline)
    - [tail](#tail)
    - [report](#report)
  - [Sync-pipeline processors](#sync-pipeline-processors)
- [Application server](#application-server)
  - [Resources](#resources)
  - [Production build](#production-build)
  - [Server start/stop](#server-startstop)
- [Development](#development)
  - [MongoDB Instance](#mongodb-instance)
  - [Watches](#watches)
  - [Client](#client)
- [Integrating the science-catalog with a web site](#integrating-the-science-catalog-with-a-web-site)
  - [Example Apache reverse proxy configuration](#example-apache-reverse-proxy-configuration)
  - [Cross-Origin Resource Sharing](#cross-origin-resource-sharing)
- [Linux service management possibilities](#linux-service-management-possibilities)
  - [Example SystemD Unit](#example-systemd-unit)
  - [Example SystemV init.d Script](#example-systemv-initd-script)

## Application overview

The science-catalog application is made up of several distinct parts

- [`Database`](#database) [MongoDB](https://www.mongodb.com/) is the database server that holds and indexes the application data.
- [`Sync-pipeline`](#sync-pipeline) (and supporting scripts) Technically compiled along with the application server but run as command-line utilities.
- [`Application server`](#application-server) A [NodeJS](https://nodejs.org/)/[Express](https://expressjs.com/) application server that hosts simple REST web services and runs differentr reports on the data.
- [`Application client`](#client) An [Angular](https://angular.io/) single page application that displays the data ([module level documentation](../client_doc)).

The [`Sync-pipeline`](#sync-pipeline) is the most involved portion of the application requiring understanding and can be configured in different ways to support different types of deployment.

## Database

### MongoDB

The application requires a MongoDB instance (originally built on v3.6.5 but newer should be OK as well).  Since the catalog is a read-only copy of information mastered (currently) in Science Base the mongo instance, by default, should not require authentication (not documented here).  If the mongo instance were to be setup/configured to require authentication then the application would need to be started with the `MONGO_USER` and `MONGO_PASS` environment variables set.  See the [dbEnv](globals.html#dbenv) documentation for information about the environment variables that can be used to tailor the connection to MongoDB.

### Data model

The application data model consists of the following five MongoDB collections.

_Note:_ While not a technical requirement (or necessary) the data stored in the database `LCC` and `Item` collection is sourced from [ScienceBase](https://www.sciencebase.gov/).  MongoDB and ScienceBase have object id representations that are compatible with one another (24 byte hex strings).  Because of this compatibility rather than allowing MongoDB to generate new object identifiers (as would normally be the case) the existing identifiers from ScienceBase are used when populating the database.

This means that for any item in the `LCC` or `Item` collection you can find its corresponding object in ScienceBase by taking the value of its `_id` property and filling it into a a URL to ScienceBase like `https://www.sciencebase.gov/catalog/item/<_id>`.

The reverse is, of course, obviously true as well.  If you are looking at a project or product that is sync'ed into the catalog in ScienceBase you can easily find its corresponding document in the `Item` collection using its id (E.g. `db.Item.find({_id:ObjectID('<id>')}))`);

#### Lcc

See [LccIfc](interfaces/lccifc.html) for document properties.

This collection contains a list of Landscape Conservation Cooperative documents.

While this collection contains a very small amount of information (one document per LCC) it plays an important but obscure role in the application.  The list of LCCs here drives what is sync'ed into the catalog.  If you don't populate this collection then a sync will result in nothing to do and an empty catalog.  It's important to note that by virtue of this fact you could build a copy of the catalog that contains only ScienceBase items for a single LCC or sub-set of LCCs if that were desirable.

The [`bin/lcc`](#lcc-script) script facilitates population of this collection for you.  It also has convenience abilities to discover the necessary IDs of LCCs from lccnetwork.org or to populate the collection with all known LCCs (again provided by lccnetwork.org).

_IMPORTANT:_ From an application perspective the `Lcc` and `Item` collections are strongly associated with one another.  This means if you have a populated catalog and you use the `./bin/lcc` utility to remove a single LCC from the `Lcc` collection ALL of that LCC's corresponding products and projects will also be removed from the `Item` collection at that time.

#### Contact

See [ContactIfc](interfaces/contactifc.html) for document properties.

This collection contains one document per contact referenced by items in the catalog.  This collection is a best effort to solve the issue that each `mdJson` document is completely isolated from every other `mdJson` document.  While a contact reference in a given `mdJson` document may actually refer to the same person or organization reference by many other documents there is no normalized repository (other than this collection) that keeps track of that.

This collection is populated by the [Contacts](classes/contacts.html) sync-pipeline processor which processes all contacts within item `mdJson` and makes a best effort to align them.  When complete the `_lcc` and `_item` reference arrays contain the list of LCCs and Items that reference a given contact.  In this way it's easy when starting with a given contact to discover their involvement within the catalog.

#### Item

See [ItemIfc](interfaces/itemifc.html) for document properties.

This collection contains one document per item sync'ed into the catalog (projects and products for each LCC).  The `mdJson` property contains the corresponding item's `mdJson` document (completely unmodified).  All other properties on a document exist, and have been organized, to support the front-end application to speed up discovery of items in many different ways.

#### SyncPipelineProcessorEntry

See [SyncPipelineProcessorEntryIfc](interfaces/syncpipelineprocessorentryifc.html) for document properties.

The "sync-pipeline" is a configurable set of processes that run to populate the catalog, deal with "dirty data", organize the catalog contents for ease of access by its client application and possibly push data from the catalog out to other systems (e.g. lccnetwork.org).  This collection contains one entry per process in the configured pipeline (once it has been run at least one time).  Each document in the collection captures information about its corresponding processor like last start/end time, whether an error occurred and/or the results of a processor's last run.

The [`bin/report`](#report) utility simply runs over this collection, and with the help of a document's owning processor, formats its contents as text output.

#### SyncPipelineProcessorLog

See [SyncPipelineProcessorLogIfc](interfaces/syncpipelineprocessorlogifc.html) for document properties.

This collection captures log entries output by sync-pipeline processors.  Log entries have categories like; `info`, `error`, `warn` and `debug` and may contain many different kinds of information.  Each log entry keeps track of what LCC and Item the log entry corresponds to, what processor logged it, a message, a processor specific code and an optional `data` property which is opaque and specific to its processor.

Log entries are intended to be able to carry much more information than just a warning or error log message.  Each sync-pipeline processor documents the list of values it will use as `code` property values on log entries.  The `data` property can then be used to carry useful information to aid in understanding an issue.

For example the [`Simplification`](classes/simplification.html) processor makes use of the [`SimplifciationCodes`](enums/simplificationcodes.html) `enum` when issuing log messages.  The `enum` documents the circumstances under which each `code` will be logged.

Depending on the situation a value for the `data` property may be supplied.  For example when a `missing_contact` log entry is issued, not only will the log entry indicate which LCC/Item the issue corresponds to but the `data` property will contain item specific details like:

- `missingContactId` The missing contact id from the `mdJson`
- `contacts` The corresponding contacts array from the `mdJson` document.
- `context` The context within the `mdJson` where the missing id was found.

## Sync-pipeline

The sync-pipeline is a configurable set of processes that run to popuplate, cross-reference, simplify, re-organize item data for easier consumption by the science-catalog application itself.  A pipeline is configured as a JSON document which contains an array of processor objects along with optional configuration for each which is then passed to the [`bin/pipeline`](#pipeline) script.

From a system management perspective the scripts found in the `bin` directory are more important than understanding each current processor that has been implemented.  For this reason scripts will be discussed first with more details about the pipeline and the currently available processors

### Scripts

The following sections document the command-line utility scripts that support the Sync-pipeline.  All scripts can be found in the `bin` directory of the repository.

_Note:_ If you are on a Unix system (MacOS, Linux distro, etc.) then you should be able to execte the scripts directly assuming that an appropriate `node` utility is within your `PATH`.  Each script is really just a NodeJS script so if you are in a Windows environment then rather than running a script like `./bin/lcc <args>` you would simply invoke directly using node like `node bin\lcc <args>`

#### lcc
<a name="lcc-script"></a>
```
$ ./bin/lcc --help

  Usage: lcc [options]

  Options:

    -V, --version      output the version number
    --lcc <id>         The lcc to add or remove.
    --action <action>  What to do with the LCC (add, addAll, remove, removeAll, list or available. default add) (default: add)
    -h, --help         output usage information
```

The value of the `--action` argument indicates what the script should do.  The action options are:

- `list` List all LCCs currently in the collection.
- `available` Convenience action that lists all possible LCCs known to lccnetwork.org along with their ids.
- `add` Add a single LCC to the collection so it will be sync'ed in the future (the `--lcc` argument is required).
- `remove` Remove a single LCC from the collection (the `--lcc` argument is required). **SEE NOTE BELOW**
- `addAll` Convenience action that will add all available LCCs to the collection.
- `removeAll` Convenience action that will remove any LCCs currently in the collection **SEE NOTE BELOW**

_IMPORTANT:_ From an application perspective the `Lcc` and `Item` collections are strongly associated with one another.  This means if you have a populated catalog and you use the `./bin/lcc` utility to remove a single LCC from the `Lcc` collection ALL of its corresponding products and projects will also be removed from the `Item` collection at that same time.  This relationship is supported via Mongoose middleware so will apply anywhere within application code that might remove an LCC.

#### pipeline

```
$ ./bin/pipeline --help

  Usage: pipeline [options]

  Options:

    -V, --version         output the version number
    -p --pipeline <file>  The pipeline configuration
    -f --fork             Whether to run the pipeline in process or in separate processes.
    -h, --help            output usage information
```

Executes a "pipeline" stored in a JSON document.

The following is the contents of the current `pipeline.json` document that is in use by the production system (with any credentials removed).

```
[{
  "processorId": "FromScienceBase",
  "module": "./processors/FromScienceBase",
  "config": {
    "pauseBetweenLcc": 120000,
    "retryAfter": 180000
  }
},{
  "processorId": "Contacts",
  "module": "./processors/Contacts",
  "config": {}
},{
  "processorId": "LccnetContactAlignment",
  "module": "./processors/LccnetContactAlignment",
  "config": {"lccnetwork": "https://lccnetwork.org"}
},{
  "processorId": "Simplification",
  "module": "./processors/Simplification",
  "config": {}
},{
  "processorId": "ItemsToLccnet",
  "module": "./processors/ItemsToLccnet",
  "config": {
      "lccnetwork": "https://lccnetwork.org",
      "username": "**********",
      "password": "**********"
  }
},{
  "processorId": "Report",
  "module": "./processors/Report",
  "config": {}
}]
```

This pipeline does the following (more details later):

- `FromScienceBase` pulls items from ScienceBase for each LCC found within the `LCC` collection.  Items no longer found in ScienceBase that exist in the catalog from an earlier sync will be removed.
- `Contacts` perform generic consolidation of contacts found within project/product `mdJson` documents.
- `LccnetContactAlignment` cross-references the `Contacts` collection with the contacts database on lccnetwork.org so that relationships between items and contacts can be easily referenced.
- `Simplification` processes `mdJson` documents re-organizing its contents for ease of access by the front-end application, indexing, reporting , etc.
- `ItemsToLccnet` pushes the contents of the catalog (minimal info) into lccnetwork.org for display within that network of websites (actual project/product content displayed directly from the catalog).
- `Report` processes the contents of the `SyncPipelineProcessorEntry` collection (excluding its own document) formats each processor's results as text and stores the results as its result.

_Note:_ The science-catalog was implemented to drive content on lccnetwork.org _but_ it was also designed to be useful outside of that context.  If the `LccnetContactAlignment` and `ItemsToLccnet` processors were removed from the pipeline above then the result would be a standalone science-catalog, independent of lccnetwork.org that linked all items back to their origins in ScienceBase.

#### tail

```
 $ ./bin/tail --help

  Usage: tail [options]

  Options:

    -V, --version             output the version number
    -c --criteria <criteria>  Parseable JSON criteria.
    -h, --help                output usage information
```

This command allows you to watch the [`SyncPipelineProcessorLog`](#syncpipelineprocessorlog) collection and formats its documents for command-line consumption (not all available details visible from the output of this command).  The `SyncPipelineProcessorLog` is a "capped" collection.  This means that the collection has a maximum allowable size _and_ that applications can watch changes to the collection in real-time.  This utility will watch the collection in real-time so you can see log output/progress during a sync.

Since during a sync documents are added to this collection extremely rapidly the `-c` argument can be used to filter what log entries are shown.  For example `./bin/log -c '{"type":"warn"}'` would watch the log and output only warning log entries.

#### report

This command does not have any help or take any arguments.  Executing it will find the `Report` processor `SyncPipelineProcessorEntry` document (if there is one) and output its results.

### Sync-pipeline processors

Below are links to the class-level documentation for each of the current set of implmented Sync-pipeline processors along with a link to the `enum` each uses when issuing log messages (if the processor does any logging).

Each processor must extend the [`SyncPipelineProcessor<C, R>`](classes/syncpipelineprocessor.html) base class.  The `C` and `R` generics must be supplied at implementation time and define the interfaces that dictate input configuration (`C`) and the output the given processor generates (`R`).  As a result their class-level documentation will also lead you directly to the documentation for their configuration and the output they produce (for convenience both are included below as well).

The `C` (configuration) generic input defines what can be supplied as input via the `config` property for a given processor within a pipeline `JSON` input document (see the example `pipeline.json` in the [`bin/pipeline`](#-bin-pipeline-) section above).  The `R` (result) generic documents what can be found stored for the given processor's entry in the [`SyncPipelineProcessorEntry`](#-syncpipelineprocessorentry-) collection in the `results` property.

- [`FromScienceBase`](classes/fromsciencebase.html)<[FromScienceBaseConfig](interfaces/fromsciencebaseconfig.html), [ItemCounts](classes/itemcounts.html)[]> log codes: [FromScienceBaseLogCodes](enums/fromsciencebaselogcodes.html)
- [`Contacts`](classes/contacts.html)<[ContactsConfig](interfaces/contactsconfig.html), [ContactsOutput](classes/contactsoutput.html)> (no logging)
- [`LccnetContactAlignment`](classes/lccnetcontactalignment.html)<[LccnetContactAlignmentConfig](interfaces/lccnetcontactalignmentconfig.html), [LccnetContactAlignmentOutput](classes/lccnetcontactalignmentoutput.html)> log codes: [LccnetContactAlignmentCodes](enums/lccnetcontactalignmentcodes.html)
- [`Simplification`](classes/simplification.html)<[SimplificationConfig](interfaces/simplificationconfig.html), [SimplificationOutput](classes/simplificationoutput.html)> log codes: [SimplificationCodes](enums/simplificationcodes.html)
- [`ItemsToLccnet`](classes/itemstolccnet.html)<[ItemsToLccnetConfig](interfaces/itemstolccnetconfig.html), [ItemsToLccnetOutput](classes/itemstolccnetoutput.html)> log codes: [ItemsToLccnetLogCodes](enums/itemstolccnetlogcodes.html)
- [`Report`](classes/report.html)<[ReportConfig](interfaces/reportconfig.html), [ReportOutput](classes/reportoutput.html)> (no logging)

## Application server

The application server is a fairly simple and thin [ExpressJS](https://expressjs.com/) web server that exposes a handful of REST resources tied directly to MongoDB collections and relationships for discovering related information.

### Resources

Aside from custom reporting endpoints resources support OData "like" parameters like:

- `$filter` Used to filter selected documents using a robust query syntax.
- `$top` Specifies a maximum number of documents to return (resource may inforce its own default if not supplied).
- `$skip` Specifies a number of preceeding documents to skip (used in conjuction with `$top` to support paging).
- `$select` Specifies a sub-set of properties of interest for the documents in a given collection.
- `$orderby` Specifies a property to sort results by.

See [odata-resource](https://www.npmjs.com/package/odata-resource) for more information.

The following endpoints are available.

- `item` The `Item` collection.
- `item/distinct` Static relationship allowing for selecting distinct property values from items.
- `item/qaqcIssues` Custom static relationship map-reduce report that examines items looking for common known problems with their `mdJson`.
- `item/summaryStatistics` Static relationship map-reduce report in support of UI summary information.
- `item/fwsFunding` Status relationship map-reduce report in support of reporting on funding information.
- `lcc` The `LCC` colleciton.
- `lcc/items` An LCC specific static relationship into the Items collection that presents only items specific to a given LCC.
- `pipeline` The `SyncPipelineProcessorEntry` collection.
- `log` The `SyncPipelineProcessorLog` collection.

_Note:_ The last two are currently not in use by the application but could be used to build administrative reporting, etc. as a view into the active sync-pipeline process.

### Production build

```
$ npm install; cd app_src; npm install; cd ..
$ npm run build-all
```

The `npm run build-all` command will build the server and client and generate the server and client documentation.

### Server start/stop

For simplicity this project includes the [`forever`](https://www.npmjs.com/package/forever) node package.  This is a simple utility to manage node applications and make sure that they remain running.  Once compiled the server can be managed via a command like `npm run start|stop|restart`.

The application server, by default listens on port `8989`.  If you want it to listen on another port you can use the `SC_HTTP_PORT` environment variable to change it.

E.g.
```
$ SC_HTTP_PORT=8080 npm start
```

In a real production environment something more robust would be necessary to ensure the service comes to life on reboot, etc.  For examples for a Linux environment see [Linux server management possibilities](#linux-server-management-possibilities) below.

`Note:` This application could be easily wrapped up in a set of docker containers to properly isolate dependency versions of NodeJS and MongoDB and simplify server management.  At the moment however it is assumed that the application run on a server where appropriate versions of NodeJS and MongoDB have been installed and will be maintained.

## Development

### MongoDB Instance

If you have [docker](https://www.docker.com/) installed then, rather than installing and maintaining MongoDB, you can use a set of npm script definitions to manage a containerized MongoDB instance for you.  The scripts actually use `docker-compose` since its configuration for mounting volumes works better for relative paths.

Before running any of these commands create a `backups` directory within your repository.  This directory is ignored by `git` and will be mounted as a volume that can be used to capture database contents and restore them later (or whatever).  See notes below.

- `npm run mongo-dev-up` Run the first time to create and start your mongo instance the first time (after once then use `start` and `stop` variants).
- `npm run mongo-dev-logs` Tails the MongoDB output of your running instance.
- `npm run mongo-dev-start` Starts a previously created MongoDB instance.
- `npm run mongo-dev-stop` Stops your current MongoDB instance.
- `npm run mongo-dev-down` Tears down your MongoDB instance.

It's important to understand that if you run `down` this will stop your MongDB instance and throw away its container which means any underlying database that was populated within it will be thrown away as well (since the database files are not mounted on an external volume but left to container persistence).

The containerized MongoDB instance will bind to your local port `27107` (mongo's default port) and so requires that port be free.

You can use the `backups` volume to backup restore database instances.

_Note:_ In case the application were ever containerized, which would be relatively simple to do, for development purposes this repository uses a `docker-compose` file named `docker-compose-dev.yml` rather than the standard `docker-compose.yml` which means the `-f` argument must be supplied to direct calls to `docker-compose` in this context.

E.g.
```
$ docker-compose -f docker-compose-dev.yml exec mongo mongodump -d science-catalog --archive=/backups/sc-backup.archive
```

Will result in a backup of the catalog database in `./backups/sc-backup.archive` which could be restored like:

```
$ docker-compose -f docker-compose-dev.yml exec mongo mongorestore --archive=/backups/sc-backup.archive
```

### Watches

The server source code can be found in the `src` directory.  If developing on the server you can execute `npm run build-watch` to begin watching for code changes, and then in a separate window run `npm run server-watch` to start the application server and have it recompile/restart as the compiled source code changes.

If just working on sync-pipeline specific functionality where an application server is not necessary you can choose to instead run `npm run build-watch`.  This will result in the same build artifacts as `server-watch` but simply will not also start the application server.

The client, Angular, source code can be found in the `app_src` directory.  If developing on the client you can execute `cd app_src; npm run watch` to compile a development version of the client and have it re-compiled as source code changes.

### Client

The client source code can be found in the `app_src` directory.  Its module level documentation can be found [here](../client_doc).

## Integrating the science-catalog with a web site

_Note:_ To keep things simple the root of functionality on the science-catalog app server is prefixed with `/science-catalog` so proxied URLs can remain consistent.

There is also an `app-src` endpoint that simply lists the JavaScript/CSS files that make up the client single page application.

This endpoint exists because production builds of the client application dynamically generate new filenames with each build and the list of files differs between production and development builds.  This endpoint can be used to bootstrap the application into an external website by pulling in the JavaScript/CSS files and including an `<science-catalog></science-catalog>` element within page markup once they are loaded.  This endpoint must be used rather than hard-coding since if the client application is ever re-built the resulting filenames will change.

### Example Apache reverse proxy configuration

A relatively simple way of integrating the catalog with another site would be to add the application directly to the site's Apache configuration via reverse-proxy and using the `app-src` endpoint mentioned previously to bootstrap the application (say with custom JavaScript or simple PHP, etc.).  In this setup the science-catalog client can access its resources directly via the `/science-catalog` path without browser restrictions.

Added to `VirtualHost` configuration

```
ProxyRequests Off
ProxyVia Off
ProxyPass /science-catalog http://localhost:8989/science-catalog
ProxyPassReverse /science-catalog http://localhost:8989/science-catalog
ProxyPreserveHost On
```

### Cross-Origin Resource Sharing

If you want other browser applications, hosted on other domains, to be permitted access to make API calls (say to embed a copy of the science-catalog there or leverage its api) you will need to configure CORS to allow such requests.

To do so create a `config.json` file, at the root of this repo, with configuration like:

```
{
    "cors": {
        "Access-Control-Allow-Origin": "http://www.othersite.com http://www.yetanothersite.com",
        "Access-Control-Allow-Methods": "GET"
    }
}
```

The `Access-Control-Allow-Origin` key allows for a space delimited list of request origin's that should be allowed to make AJAX requests.

_Note:_ This _could_ also be used to integrate a standalone version of the science-catalog with a web-site BUT there currently is no direct support for running the application with SSL enabled and browsers will not allow downgraded AJAX requests (sites protected via `https` cannot make `http` AJAX requests) so the catalog application server would need to be proxied into another server like Apache to gain SSL support as it stands today (which would be better than including SSL support at any rate since then services like letsencrypt can be used to more easily manage site certificates).

## Linux service management possibilities

The example configuration scripts, etc. below contain paths that would require updating before being useful on a given system.  In addition they assume that `nvm` was used to install a recent version of node/npm as opposed to a single version installed via system packaging tools.  Point being all paths in examples below would need to be updated appropriately regardless.

This type of configuration requires `root` privileges.  Any example commands assume your are running as `root` already otherwise `sudo` would be necessary to run the commands as `root`. 

### Example SystemD Unit

If available configuring the application server as a systemd unit is preferred since it monitors the underlying process, makes sure it keeps running, re-directs logs to the syslog, etc.

The unit file would be placed at `/etc/systemd/system/science-catalog.service`

This route allows SystemD to play the role that `forever` plays in the most simplistic configuration.  The `systemctl` command can be used to manage the unit (E.g. `systemctl start|stop|restart science-catalog`)

```
[Unit]
Description=science-catalog database service
Requires=network.target mongod.service
After=mongod.service

[Service]
Environment="PATH=/home/adamspe/.nvm/versions/node/v9.11.2/bin:/home/adamspe/science-catalog/node_modules/.bin"
WorkingDirectory=/home/adamspe/science-catalog
Restart=always
ExecStart=/home/adamspe/.nvm/versions/node/v9.11.2/bin/node dist/index.js
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=science-catalog
User=adamspe
Group=adamspe

[Install]
WantedBy=multi-user.target
```

After placing the unit file it would be enabled using `systemctl enable science-catalog` like `systemctl 

### Example SystemV init.d Script

If systemd is not an option then a basic SystemV script can be wrapped around calls to the `npm run start|stop|restart` commands relying on `forever` to ensure the server remains constantly available.

The script would be placed at `/etc/init.d/science-catalog` and need its execute privileges updated appropriately.

This route simply wraps the usage of `forever` within a SystemV script.

```
#!/bin/sh

WD=/home/adamspe/science-catalog
RUNAS=adamspe
NODE_BIN=/home/adamspe/.nvm/versions/node/v9.11.2/bin

run_cmd() {
  cdir=$PWD
  cd $WD
  su -c "PATH=${NODE_BIN}:${PATH} npm $1" $RUNAS
  cd $cdir
}

case "$1" in
  start)
    run_cmd start
    ;;
  stop)
    run_cmd stop
    ;;
  restart)
    run_cmd restart
    ;;
  *)
    echo "Usage: $0 {start|stop|restart}"
esac
```

Link the script into appropriate run-levels like `update-rc.d science-catalog enable`.