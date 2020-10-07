const pino = require('pino');
const {getConfig} = require('./config');

const redactPaths = [
    'password',
    '*.password',
    'buffer',
    '*.buffer',
    'params.upfile.buffer'
];

class LogWrapper {
    constructor(name) {
        this.name = name;
        let config = getConfig().logger;
        let level = config[name] || config.default;
        if(typeof level !== 'string' && pino.levels.values[level] === undefined) {
            level = 'info';
        }
        this.logger = pino({name, level, redact: { paths: redactPaths, censor: '*****' }} );
    }
    get level() {
        return this.logger.level;
    }
    trace(...args){
        this.logger.trace(...args);
    }
    debug(...args){
        this.logger.debug(...args);
    }
    info(...args){
        this.logger.info(...args);
    }
    warn(...args){
        this.logger.warn(...args);
    }
    error(...args){
        this.logger.error(...args);
    }
    fatal(...args){
        this.logger.fatal(...args);
    }
}
function getLogger(name) {
    return new LogWrapper(name);
}
module.exports = {
    getLogger,
    logLevels: pino.levels.values
};
