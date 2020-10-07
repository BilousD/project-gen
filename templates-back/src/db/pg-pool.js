const _ = require('lodash');
const { resolve } = require('path');
const { getConfig } = require('../../config');
const { Pool } = require('pg');
const { readFileSync } = require('fs');
const log = require('../../log').getLogger('PG.POOL');

class PgPool {
    constructor() {
        let config = getConfig();
        if(config.db) {
            this.dbInfo = config.db;
        }
        process.on('exit', () => this.onExit());
    }
    async init() {
        log.info('Init DB (postgres) connection: %o', this.dbInfo);
        let ddl = readFileSync(resolve(__dirname, './db.sql'), 'utf8');
        await this.query(ddl);
    }
    async stop() {
        return this.onExit();
    }
    async onExit() {
        log.trace('onExit');
        if(_.isObject(this.pool)) {
            this.pool.end();
        }
    }
    onPullError(err) {
        log.error(err);
        delete this.pool;
    }
    createPull() {
        log.trace('createPull: %o', this.dbInfo);
        const newPool = new Pool(this.dbInfo);
        newPool.on('error', err => this.onPullError(err));
        return newPool;
    }
    async getPool() {
        log.trace('getPool');
        if (_.isUndefined(this.pool)) {
            this.pool = this.createPull();
        }
        return this.pool;
    }
    async query(sqlString, values) {
        log.debug('query: %s, %o', sqlString, values);
        const pool = await this.getPool();
        log.debug('finished awaiting pool: %o', pool);
        try {
            let result = await pool.query(sqlString, values);
            log.debug('completed: %s, %o', sqlString, result);
            return result;
        } catch (e) {
            log.error('onPullError %s', e);
            throw e;
        }
    }
    async getClient() {
        try {
            let pool = await this.getPool();
            let client = await pool.connect();
            return new WrapperClient(client);
        } catch (e) {
            log.error()
            throw e;
        }
    }
}
class WrapperClient {
    constructor(client) {
        this.closed = false;
        this.client = client;
    }
    async startTransaction(){
        if(!this.closed){
            return this.query('BEGIN');
        }
        throw new Error('You try to start transaction for closed connection');
    }
    async commit() {
        if(!this.closed) {
            this.closed = true;
            try{
                await this.query('COMMIT');
            } finally {
                this.client.release();
            }
        } else {
            console.log('You try to COMMIT already closed connection');
        }
    }
    async rollback() {
        if(!this.closed) {
            this.closed = true;
            try{
                await this.query('ROLLBACK');
            } finally {
                this.client.release();
            }
        } else {
            console.log('You try to ROLLBACK already closed connection');
        }
    }
    async query(sqlString, values) {
        try {
            return await this.client.query(sqlString, values);
        } catch (e) {
            throw e;
        }
    }
}
const pgPool = new PgPool();
module.exports = pgPool;
