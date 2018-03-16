## Science-Catalog (Server)

## Development watch

Run `npm run-script watch` to start the application server and have changes automatically compiled and loaded for use.

If just working on sync-pipeline specific functionality where an application server is not necessary you can choose to instead run `npm run-script build-watch`.  The two will result in the same build artifacts but the former will also run the application server.

## Production build

Run `npm run-script build` to build the application server and sync-pipeline functionality.  All build artifacts will be stored in the `dist` directory.

## Initial setup

```
$ npm install
$ npm run-script build
$ cd app_src
$ npm run-script build
```

### Note

Throughout these instructions scripts are used periodically to interact with the system.  Within this documentation scripts are run directly as would be done on a Unix system like `./bin/lcc --help`.  All scripts are actually small node applications that rely on the shell scripting shebang to implicitly run them with node.  On windows systems these scripts will require you actually use node to execute them like `node bin\lcc --help`.  The documentation however will only include the former way of running these utility scripts.

_TODO_ database setup, etc.

## Syncing projects/products

The sync pipeline requires a pipeline input file that instructs it what steps to run, with what configuration and in what order.  See the "Example" section for an example of a simple pipeline as it stands.

The initial pipeline step, `FromScienceBase`, is the most important in that it seeds the database with the content that all otehr steps rely upon.  The `FromScienceBase` sync-processor runs solely based on which LCC entries the `Lcc` collection has populated with so if you run it on a clean system it will do nothing.  The `bin/lcc` script can be used to manage the LCCs in the system (requires connectivity to lccnetwork.org).  Run `./bin/lcc --help` to see instructional output about the command.  With the utility you can

## Example `pipeline.json`

```
[{
  "processorId": "FromScienceBase",
  "module": "./processors/FromScienceBase",
  "config": {}
},{
  "processorId": "Contacts",
  "module": "./processors/Contacts",
  "config": {}
},{
  "processorId": "Simplification",
  "module": "./processors/Simplification",
  "config": {}
},{
  "processorId": "Report",
  "module": "./processors/Report",
  "config": {}
}]
```
