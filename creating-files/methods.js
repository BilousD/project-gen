const {camelize} = require('../change-case');
const {getProperties} = require('./manageTypes');
const _ = require('lodash');

function searchType(swagger,properties) {
    let definitions = swagger.definitions;
    // circle through definitions to look for similarities
    for(const [def, defValue] of Object.entries(definitions)) {
        // defined type has to have same properties and same number of them
        if(Object.keys(properties).length === Object.keys(defValue.properties).length) {
            let searchingFor = Object.keys(properties); // example: searching for [ id, data, someMoreData]
            // check if defined type properties and our properties are the same
            for(const [property, propValue] of Object.entries(defValue.properties)) {
                for(let i = 0; i < searchingFor.length; i++) {
                    // TODO check for inside, for cases when property has properties inside
                    // TODO probably can call similar function
                    if(searchingFor[i] === property && properties[searchingFor[i]].type === propValue.type) {
                        // found property so we can delete it and get out of loop
                        searchingFor.splice(i, 1);
                        i = searchingFor.length;
                    }
                }
            }
            if(searchingFor.length === 0) {
                // found defined type
                return def;
            }
        }
    }
    // looped through definitions, but nothing similar found, so we need to make our own definition
    // loop to find free name for definition
    for(let i = 0; i < 999; i++) {
        if(!definitions[`Anonymous${i}Type`]){
            definitions[`Anonymous${i}Type`] = {type:'object', properties};
            properties['$ref'] = `#/definitions/Anonymous${i}Type`;
            return `Anonymous${i}Type`;
        }
    }
}
// in case when someone wanted multidimensional array
function switchArray(swagger, schema) {
    let type = '';
    if (schema.items['$ref']) {
        type = schema.items['$ref'].split('/').pop();
    } else {
        switch (schema.items.type) {
            case 'integer':
            case 'number':
                type = 'number';
                break;
            case 'string':
                type = 'string';
                break;
            case 'boolean':
                type = 'boolean';
                break;
            case 'array':
                type = switchArray(swagger, schema.items) + '[]';
                break;
            case 'object':
            default:
                if (schema.items.properties) {
                    type = searchType(swagger, schema.items.properties);
                } else {
                    type = schema.items.type;
                }
                break;
        }
    }
    return type;
}

function observableType(swagger, schema) {
    if(schema['$ref']) {
        return '<' + schema['$ref'].split('/').pop() + '>';

    } else {
        switch (schema.type) {
            case 'integer':
            case 'number':
                return '<number>';
            case 'string':
                return '<string>';
            case 'boolean':
                return '<boolean>';
            case 'array':
                return '<' + switchArray(swagger, schema) + '[]>';
            case 'object':
            default: // if someone forgot to put 'type: object', check for .properties // TODO check for .items
                if (schema.properties) {
                    return '<' + searchType(swagger,schema.properties) + '>';
                } else {
                    return '<'+ schema.type + '>';
                }
        }
    }
}

function getMethods(swagger, path, httpMethod) {
    //parsedSwagger.paths[path][key], controllerCamel, parsedSwagger, path, key
    const method = swagger.paths[path][httpMethod];
    const controller = swagger.paths[path]['x-swagger-router-controller'];

    let parametersController = [];
    let parameters = [];
    let queries = [];
    // let result = await api.${httpMethod}('${method}',{${parameters.join(': \'foobar\', ')}});
    if (method['x-query']) {
        queries = [];
        function processQuery(query) {
            let checkDuplicates = {};
            let i = 1;
            let multiple = false;
            let forItem = '';
            let forArgs = [];
            // replacing insert values (:pets[].id, :urls[])
            let newQuery = query.replace(/:[\w\[\].]*/g, (fld)=>{
                // const p = fld.replace(':', '').split('[]');
                const p = fld.replace(':', '')
                // split into only two for now, only one for(), TODO queries with multidimensional arrays
                let a = [];
                if(p.indexOf("[]") > 0) {
                    // body[].id => [body, .id]
                    a = p.split('[]');
                    // body[].items[] => error
                    if(a.length > 2) throw new Error(`Multiple arrays in single query is not supported for now, ${query}`);
                    // body.items[] => [body, items] => items
                    let item = a[0].split('.').pop();
                    // items[] => item, body[] => b
                    if(item.length < 2) {
                        item += 'Temp';
                    } else {
                        if (item.slice(-1) === 's') {
                            item = item.slice(0, -1);
                        } else {
                            item = item.slice(0, 1);
                        }
                    }
                    if(checkDuplicates[item+a[1]]) {
                        return checkDuplicates[item+a[1]];
                    } else {
                        if(multiple && (forItem && (item !== forItem))) {
                            throw new Error(`Multiple arrays in single query is not supported for now, ${query}`);
                        }
                    }
                    multiple = true;
                    forArgs = a;
                    forItem = item;
                    checkDuplicates[forItem+a[1]] = '$'+i++;
                    return checkDuplicates[forItem+a[1]];
                }


                if(checkDuplicates[p]) {
                    return checkDuplicates[p];
                }
                checkDuplicates[p] = '$'+i++;
                return checkDuplicates[p];
            });
            if(multiple) {
                queries.push(`for(let ${forItem} of ${forArgs[0]}) {
        log.debug(\`${method.operationId} with query "${query}"\`);
        result = await pgPool.query(\`${newQuery}\`, [${Object.keys(checkDuplicates).join(', ')}]);
    }`);
            } else {
                queries.push(`log.debug(\`${method.operationId} with query "${query}"\`);
        result = await pgPool.query(\`${newQuery}\`, [${Object.keys(checkDuplicates).join(', ')}]);`);
            }
        }
        if(_.isArray(method['x-query'])){
            for (let query of method['x-query']) {
                processQuery(query);
            }
        } else {
            processQuery(method['x-query']);
        }
        if (method.parameters && method.parameters.length > 0) {
            parametersController.push(`req.swagger.params.${method.parameters.map(e => e.name).join(".value, req.swagger.params.")}.value`);
            parameters.push(method.parameters.map(e => e.name));
        }
    } else if (method.parameters) {
        for (let parameter of method.parameters) {
            // there was only this but i dont know why
            // if (!method['x-query']) parameters.push(parameter.name);
            if(parameter.schema && parameter.schema['$ref']) { // there could be property as object
                let ref = _.get(swagger, parameter.schema['$ref'].replace('#/', '').split('/'));
                for (const [prop, propParam] of Object.entries(ref.properties)) {
                    switch (propParam) {
                        case 'object':
                            // do something like `${prop} . ${propParam.key}`
                        case 'array':
                            // do something? probably should not be there
                        default:
                            parameters.push(prop);
                    }
                }
            } else {
                switch(parameter.type) {
                    case 'array':
                        // probably should not be there
                    case 'object':
                        // probably should be something like `${prop} . ${propParam.key}`
                    case 'string':
                    case 'integer':
                    case 'number':
                    default:
                        parameters.push(parameter.name);
                }
            }

            parametersController.push(`req.swagger.params.${parameter.name}.value`);
        }
    }

    if(queries.length === 0) {
        queries.push(`log.debug('${method.operationId} with query "SELECT NOW()" YOU SHOULD REPLACE THIS');
        result = await pgPool.query('SELECT NOW()', [${parameters.join(', ')}]);`);
    }

    let type = '<any>';
    let map = '';
    let payloadType = '<any>';
    let resPayload = 'result';
    if (method.responses[200] && method.responses[200].schema) {
        type = observableType(swagger, method.responses[200].schema)
            //        TYPE FOR HTTP OBSERVABLE
            // no ref => if array => has ref => write
            //                    => no ref => simple type => write
            //                              => object => new type
            //        => if object => has ref  ???????  => write
            //                     => no ref => new type

            // new type = searchFor()
        // TODO use _.get instead
        if(method.responses[200]['x-payload']) {
            let payload = _.get(method, 'responses[200][\'x-payload\']', '');
            // let payload = 'data'
            if(payload){
                map = `.pipe( map(resp => resp.${payload}) )`;
            }


            function recurse(object, recursePath) { // TODO if payload 'data.menu.id' and menu is '$ref' it can cause error
                // if data.id, and data is object, data.properties.id
                for (let i = 0; i < recursePath.length; i++) {
                    let temp = object[recursePath[i]];
                    if(temp) {
                        object = temp;
                    } else {
                        temp = object.properties[recursePath[i]];
                        if(temp) {
                            object = temp;
                        } else {
                            if(object['$ref']){ // TODO could possibly be error?
                                temp = _.get(_.get(swagger, object['$ref'].replace('#/', '').split('/')), 'properties');
                                if(temp) {
                                    object = temp;
                                } else {
                                    console.error('could not find payload');
                                }
                            }
                        }
                    }
                }
                return object;
            }

            let recursion;
            if (method.responses[200].schema['$ref']) {
                let recPath = method.responses[200].schema['$ref'].split('/');
                // remove '#' from array
                recPath.shift();
                recursion = recurse(swagger, recPath);
                recPath = payload.split('.');
                recursion = recurse(recursion.properties, recPath);
            } else {
                // if there is payload, and no $ref, it means that schema has type object
                // (other schema types cannot have payload inside)
                let recPath = payload.split('.');
                recursion = recurse(method.responses[200].schema.properties, recPath);
            }
            if(recursion){
                payloadType = observableType(swagger, recursion);
            }else {
                console.error(`Error: failed to find payload for ${method.operationId}, ${method.responses[200].schema['$ref']}`);
            }


            let payloadPath = payload.split('.');
            let tempPayload = 'result';
            for (let i = payloadPath.length-1; i >= 0; i--) {
                tempPayload = `{${payloadPath[i]}: ${tempPayload}}`;
            }
            resPayload = tempPayload;
        } else {
            payloadType = type;
            resPayload = `result`;
        }
            //        TYPE FOR SERVICE OBSERVABLE
            // no payload => same as http observable
            // example: payload = data
            // if (200.schema['$ref']) => if(ref.data['$ref']) => yes => write
            //                                                 => no => new type
            //                  no ref => same function as http observable, but from .data
            // no ref => 200.schema.properties.data => getType
            // ref => ref.data => getType

        // type = method.responses[200].schema;
    }

    parameters = _.uniq(parameters);
    parametersController = _.uniq(parametersController);

    function switchParams(obj) {
        switch (obj.type) {
            case 'file':
            case 'date':
            case 'string':
                return 'foobar';
            case 'boolean':
                return false;
            case 'integer':
            case 'number':
                return 0;
            case 'array':
                let testParams = [];
                if(obj.items) {
                    if(obj.items['$ref']) {
                        const ref = _.get(swagger, obj.items['$ref'].replace('#/','').split('/')).properties;
                        if (ref['x-generated-example']) {
                            testParams = [ref['x-generated-example'], ref['x-generated-example']];
                        } else {
                            testParams = [ref.example, ref.example];
                        }
                    } else {
                        const s = switchParams(obj.items);
                        testParams = [s,s];
                    }
                }
                return testParams;
            case 'object':
                let testParamsObject = {};
                if(obj.properties) {
                    for(const [property, parameters] of Object.entries(obj.properties)) {
                        if(parameters.example) {
                            testParamsObject[property] = parameters.example;
                        } else if (parameters['x-generated-example']) {
                            testParamsObject[property] = parameters['x-generated-example'];
                        } else {
                            testParamsObject[property] = switchParams(parameters);
                        }
                    }
                }
                return testParamsObject;
        }
    }
    let integrationTestParams = [];
    let testPath = '';
    let functionalTestParams = '';
    if(method.parameters) {
        for(const param of method.parameters) {
            let testParams;
            if(param.example) {
                testParams = param.example;
            } else if (param['x-generated-example']){
                testParams = param['x-generated-example'];
            } else {
                if(param.schema) {
                    if(param.schema['$ref']) {
                        const ref = _.get(swagger, param.schema['$ref'].replace('#/','').split('/')).properties;
                        if (ref['x-generated-example']) {
                            testParams = ref['x-generated-example'];
                        } else {
                            testParams = ref.example;
                        }
                    } else {
                        testParams = switchParams(param.schema);
                    }
                } else {
                    testParams = switchParams(param);
                }
            }
            integrationTestParams.push(JSON.stringify(testParams));
            switch(param.in) {
                case 'query':
                    if(testPath) {
                        testPath += `&${param.name}=${JSON.stringify(testParams)}`;
                    } else {
                        testPath += `?${param.name}=${JSON.stringify(testParams)}`;
                    }
                    break;
                case 'path':
                    testPath += '/'+JSON.stringify(testParams);
                    break;
                case 'body':
                    if (!functionalTestParams) {
                        functionalTestParams = ',';
                    }
                    functionalTestParams += JSON.stringify(testParams);
                    break;
            }
        }
    }

    let controllerMethod = `    /**
     * ${method.summary}
     * Returns: ${_.get(method, 'responses[200].description', '')}
     */
    async ${camelize(method.operationId)}(req, res) {
        try {
            log.debug('controller ${method.operationId}'${(parametersController)?', ' + parametersController.join(', ') : ''});
            let result = await ${camelize(controller)}Db.${camelize(method.operationId)}(${parametersController.join(', ')});
            let payload = ${resPayload};
            res.writeHead(200, {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'});
            res.end(JSON.stringify(payload));
        } catch (err) {
            log.error(err);
            writeResponseError(res, err);
        }
    },
`;
    let nfError = '';
    if (httpMethod === 'put' || httpMethod === 'delete') {
        nfError = `
        if(result.rowCount === 0) {
            throw new HttpCodeError(404, \`${method.operationId} [\${${parameters}}] not found\`);
        }`;
    }

    let serviceMethod = `    /**
     * ${method.summary}
     * ${parameters.join('\n     *')}
     * ${integrationTestParams.join('\n     * ')}
     */
    async ${camelize(method.operationId)}(${parameters.join(', ')}) {
        let result;
        ${queries.join('\n    ')}${nfError}
        return result.rows; 
    }
`;


    // has to be menu: { menu: MenuType , titles: [ TitleType ]}     15.01 - ????????????????????
    // expect(res).to.exist() => some result
    let integrationMethod = `    it('${method.operationId}', async ()=>{
        let result = await dao.${camelize(method.operationId)}(${integrationTestParams.join(', ')});
        expect(result).to.exist();
    });
`;


    // TODO implement headers and formData
    // if in path - put in path                header: put in header                    query
    // path = '' + id    /order/1               api.headers["api_key"] = 1 ???          ?paramName=value
    let functionalMethod = `    it('${method.operationId}', async ()=>{
        let result = await api.${httpMethod}('${path.replace(/\/{\w*}/g, '')}${testPath.replace(/"/g,'')}'${functionalTestParams});
        result = result.data;
        expect(result).to.exist();
    });
`;

    let pathParam = path;
    let query = '';
    pathParam = pathParam.replace(/{\w*}/g, (str) => {
        method.parameters.forEach(p => {
            if (p.name === str) {
                if (p['x-param-name']) {
                    if (httpMethod !== 'get' && httpMethod !== 'delete') {
                        return `\${body.${p['x-param-name']}}`;
                    } else {
                        return `\${parameters.${p['x-param-name']}}`;
                    }
                } else {
                    if (httpMethod !== 'get' && httpMethod !== 'delete') {
                        return '${body.' + str.slice(1);
                    } else {
                        return '${parameters.' + str.slice(1);
                    }
                }
            }
            if (p.in === 'query') {
                if (p['x-param-name']) {
                    if (httpMethod !== 'get' && httpMethod !== 'delete') {
                        query += p.name + '=' + '${body.' + p['x-param-name'] + '}';
                    } else {
                        query += p.name + '=' + '${parameters.' + p['x-param-name'] + '}';
                    }
                } else {
                    if (httpMethod !== 'get' && httpMethod !== 'delete') {
                        query += p.name + '=' + '${body.' + p.name + '}';
                    } else {
                        query += p.name + '=' + '${parameters.' + p.name + '}';
                    }

                }
            }
        });
    });
    if (query) {
        query = '?' + query;
    }

    let serviceFront = '';
    if (httpMethod !== 'get' && httpMethod !== 'delete') {
        serviceFront = `    ${camelize(method.operationId)}(body): Observable${payloadType}{
        return this.http.${httpMethod}${type}(API_URL + \`${pathParam}${query}\`, body, this.httpOptions)${map};
    }\n`;
    } else {
        serviceFront = `    ${camelize(method.operationId)}(parameters?): Observable${payloadType}{
        return this.http.${httpMethod}${type}(API_URL + \`${pathParam}${query}\`, this.httpOptions)${map};
    }\n`;
    }


    let importTypes = [];
    switch (type.replace(/<*>*\[*]*/g, '')) {
        case 'object':
        case 'array':
        case 'string':
        case 'number':
        case '':
            break;
        default:
            importTypes.push(type.replace(/<*>*\[*]*/g, ''));
    }
    switch(payloadType.replace(/<*>*\[*]*/g, '')) {
        case 'object':
        case 'array':
        case 'string':
        case 'number':
        case '':
            break;
        default:
            importTypes.push(payloadType.replace(/<*>*\[*]*/g, ''));
    }
    return {controllerMethod, serviceMethod, integrationMethod, functionalMethod, serviceFront, importTypes};
}

module.exports = getMethods;
