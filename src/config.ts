import * as fs from 'fs';

interface Configuration {
    cors?: any;
}

let config = {};
if(fs.existsSync('config.json')) {
    config = JSON.parse(fs.readFileSync('config.json',{encoding:'utf8'}));
}

export default config as Configuration;