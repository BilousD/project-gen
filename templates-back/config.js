const fs = require('fs');
const { resolve } = require('path');
const CONFIG = {
    logger: {
        default: 'debug'
    },
    http: {
        port: 8080,
        publishSpec: true
    },
    db: {
        host: 'localhost',
        port: 5432,
        user: 'db',
        password: 'db',
        database: 'db',
    },
    elastic: {
        http: {
            timeout: '5000ms',
            masterTimeout: '5000ms',
            requestTimeout: 5000
        },
        index:{
            number_of_shards: 5,
            number_of_replicas: 1,
        },
        search:{
            /**
             * scroll - which tells Elasticsearch how long it should keep the “search context” alive
             */
            scroll: '5m',
            maxSize: 2000
        },
        pool:{
            sniffOnStart: true,
            sniffInterval: 60000,
            sniffOnConnectionFault: true,
            sleepOnInit: 1500
        },
        logTransport: {
            error: true,
            warn: true,
            info: true,
            debug: true,
            trace: true
        }
    }
};

let getConfig = function (){
    let config = CONFIG;
    try {
        let configPath = resolve(__dirname, '../config.json');
        if(configPath && fs.existsSync(configPath)) {
            let buffer = fs.readFileSync(configPath, 'utf8');
            config = buffer.toJSON();
        }
    } catch(e) {
        console.log('Cannot read ../config.json. There is used default configuration');
    }
    getConfig = function(){
        return config;
    };
    return getConfig();
};
module.exports = {getConfig};
