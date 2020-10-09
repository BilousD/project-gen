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
                type = 'number';
                break;
            case 'string':
                type = 'string';
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
                return '<number>';
            case 'string':
                return '<string>';
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

    let queries = [
        `log.debug('${method.operationId} with query "SELECT NOW()"\nYOU SHOULD REPLACE THIS');
        const result = await pgPool.query('SELECT NOW()', [${parameters.join(', ')}]);`
    ];
    if (method['x-query']) {
        queries = [];
        let i = 1;
        let checkDuplicates = {};
        function processQuery(query) {
            query = query.replace(/:\w*/g, (fld)=>{
                const p = fld.replace(':', '');

                if(checkDuplicates[p]) {
                    return checkDuplicates[p];
                }
                checkDuplicates[p] = '$'+i++;
                if (method.parameters) {
                    parametersController.push(`req.swagger.params.${method.parameters.map(e => e.name).join(".value, req.swagger.params.")}.value`);
                }
                parameters.push(p.split('.')[0]);
                return checkDuplicates[p];
            });
            queries.push(`log.debug(\`${method.operationId} with query "${query}"\`);
    const result = await pgPool.query(\`${query}\`, [${parameters.join(', ')}]);`);
        }
        if(_.isArray(method['x-query'])){
            for (let query of method['x-query']) {
                processQuery(query);
            }
        } else {
            processQuery(method['x-query']);
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
        if(method.responses[200]['x-payload'] || true) {
            // let payload = method.responses[200]['x-payload'];
            let payload = 'data'
            map = `.pipe( map(resp => resp.${payload}) )`;

            function recurse(object, recursePath) { // TODO if payload 'data.menu.id' and menu is '$ref' it can cause error
                for (let i = 0; i < recursePath.length; i++) {
                    object = object[recursePath[i]];
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
            payloadType = observableType(swagger, recursion);

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

    let controllerMethod = `    /**
     * ${method.summary}
     * Returns: ${method.responses[200].description}
     */
    async ${camelize(method.operationId)}(req, res) {
        try {
            log.debug('controller ${method.operationId}'${(parametersController)?', ' + parametersController.join(', ') : ''});
            
            // temporary thing for proj-gen dev
            console.log(req);
            
            let result = await ${controller}Db.${camelize(method.operationId)}(${parametersController.join(', ')});
            
            console.log(result);
            let payload = ${resPayload};
            
            res.writeHead(200, {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'});
            res.end(JSON.stringify(payload));
        } catch (err) {
            log.error(err);
        }
    },
`;



    let serviceMethod = `    /**
     * ${method.summary}
     */
    async ${camelize(method.operationId)}(${parameters.join(', ')}) {
        
        ${queries.join('\n    ')}
        
        return result.rows; 
    }
`;



    let integrationMethod = `    it('${method.operationId}', async ()=>{
        let result = await dao.${camelize(method.operationId)}('${parameters.join('\', \'')}');
        expect(result).to.exist();
    });
`;



    let functionalMethod = `    it('${method.operationId}', async ()=>{
        let result = await api.${httpMethod}('${method}',{${parameters.join(': \'foobar\', ')}});
        result = result.data;
        expect(result).to.exist();
    });
`;

// TODO something here
    let serviceFront = `    ${camelize(method.operationId)}(): Observable${payloadType}{
        return this.http.${httpMethod}${type}(API_URL + '${path}', this.httpOptions)${map};
    }\n`;

    return {controllerMethod, serviceMethod, integrationMethod, functionalMethod, serviceFront,
        importTypes: [type.replace(/<*>*\[*]*/g, ''),payloadType.replace(/<*>*\[*]*/g, '')]};
}

module.exports = getMethods;