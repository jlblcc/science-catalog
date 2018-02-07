const EventEmitter = require('events'),
      log = require('../log'),
      debug = require('debug')('SyncPipelineProcessor');
// TODO log, etc.

class SyncPipelineProcessor extends EventEmitter {
    constructor(processorId) {
        if(new.target) {
            throw new TypeError('SyncPipelineProcessor is abstract.');
        }
        this.processorId = processorId;
        this.logger = log.newLogger(processorId);
    }
}
