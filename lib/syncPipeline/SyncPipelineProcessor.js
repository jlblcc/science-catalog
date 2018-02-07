const EventEmitter = require('events'),
      debug = require('debug')('SyncPipelineProcessor');
// TODO log, etc.

class SyncPipelineProcessor extends EventEmitter {
    constructor(processorId) {
        if(new.target) {
            throw new TypeError('SyncPipelineProcessor is abstract.');
        }
        this.processorId = processorId;
    }
}
