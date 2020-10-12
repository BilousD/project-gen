function createConfig(options) {
    return `const fs = require('fs');
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
        user: '${(options.dbInfo.user)?options.dbInfo.user:'db'}',
        password: '${(options.dbInfo.dbName)?options.dbInfo.dbName:'db'}',
        database: '${(options.dbInfo.dbPassword)?options.dbInfo.dbPassword:'db'}',
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
        console.log('Cannot read ../config.json. Using default configuration');
    }
    getConfig = function(){
        return config;
    };
    return getConfig();
};
module.exports = {getConfig};
`;
}
module.exports = createConfig;