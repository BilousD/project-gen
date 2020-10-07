const {camelize, fupper} = require('../change-case')

// let controller = parsedSwagger.paths[path]['x-swagger-router-controller'];
// imports, urls    <=   after parsed paths?
// serviceName    if ( option.frontendProject.oneService )


function getHeaders(controller) {


    let backController =
        `const ${camelize(controller)}Db = require('../services/${controller}-db');
const log = require('../../log').getLogger('CONTROLLER.${controller.toUpperCase()}');

module.exports = {`;


    let backService = `const pgPool = require('../db/pg-pool');
const log = require('../../log').getLogger('SERVICE.${controller.toUpperCase()}');

class ${fupper(camelize(controller))}Db {`;


    let integrationTest = `const Code = require('@hapi/code');
const expect = Code.expect;
const dao = require('../../src/services/${controller}-db');

describe('Test ${controller}-db', ()=>{`;


    let functionalTest = `const Code = require('@hapi/code');
const expect = Code.expect;
const api = require('axios').create({
    baseURL: 'http://localhost:3000/api/v1',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer cdcba59b-7701-4322-ad57-bf86b927f218'
    }
});
describe('Test ${controller} controller',()=>{`;


    return {backController, backService, integrationTest, functionalTest};
}


function getFrontHeader(importTypes, basePath, controller) {

    const serviceName = (controller)?controller:'Basic';

    return `import { Injectable } from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {
    ${importTypes.join(', ')}
    } from '../common/types';
    
const API_URL = '${basePath}';

@Injectable({
    providedIn: 'root'
})
export class ${serviceName}Service {
    httpOptions = {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    };
    
    constructor(private http: HttpClient) { }
`;
}

module.exports = {getHeaders, getFrontHeader};