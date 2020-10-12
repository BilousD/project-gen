const {fupper} = require("../change-case");
const _ = require('lodash');
function generateTypesFile(swagger){
    let type = '';
    Object.keys(swagger.definitions).forEach(key => {
        // export interface definitions[i]
        const {propertyValue, changedType} = getProperties(swagger.definitions[key].properties, key, type, swagger);
        type = changedType;
        type += `\nexport interface ${key} ${JSON.stringify(propertyValue, null, 4)}
`;
    });
    return type;
}

// have 200.schema.array.items     properties
// transform it into          type
//
// path method should always return 'type' or $ref
// because it needs to
function switchArray(items, key, type, swagger) {
    let property = '';
    if (items['$ref']) {
        property = items['$ref'].split('/').pop() + '[]';
        if(!items.example) {
            const ref = _.get(swagger, items['$ref'].replace('#/','').split('/')).properties;
            const {propertyValue, changedType} = getProperties(ref, '', '', swagger);
            items.example = ref.example;
        }
    } else {
        switch (items.type) {
            case 'integer':
            case 'number':
                property = 'number[]';
                if(!items.example){
                    items.example = [0,1];
                }
                break;
            case 'string':
                property = 'string[]';
                if(!items.example){
                    items.example = ['foo','bar'];
                }
                break;
            case 'boolean':
                property = 'boolean[]';
                if(!items.example){
                    items.example = [false,true];
                }
                break;
            case 'array':
                const {changedProperty, changedType} = switchArray(items.items, key, type, swagger);
                type = changedType;
                property = changedProperty;
                if(!items.example){
                    items.example = [items.items.example,items.items.example];
                }
                break;
            case 'object':
            default:
                if (items.properties) {
                    if (items.properties['$ref']) {
                        property = items.properties['$ref'].split('/').pop() + '[]';
                        if(!items.example) {
                            const ref = _.get(swagger, items.properties['$ref'].replace('#/','').split('/')).properties;
                            const {propertyValue, changedType} = getProperties(ref, '', '', swagger);
                            items.example = ref.example;
                        }
                    } else {            // TODO prettify it?
                        const {propertyValue, changedType} = getProperties(items.properties, key, type, swagger);
                        type = changedType;
                        property = '[' + JSON.stringify(propertyValue) + ']';
                        if(!items.example){
                            items.example = [items.properties.example,items.properties.example];
                        }
                    }
                } else {
                    property = items.type + '[]';
                    if(!items.example){
                        items.example = ['foo','bar'];
                    }
                }
                break;
        }
    }
    return {changedProperty:property, changedType:type};
}
function getProperties(obj, key, type, swagger) {
    let properties = {};
    Object.keys(obj).forEach(property => {
        if(property !== '$ref' && property !== 'example') {
            if(obj[property]['$ref']) {
                // if ref= #/def/Status
                properties[property] = obj[property]['$ref'].split('/').pop();
                if(!obj[property].example) {
                    const ref = _.get(swagger, obj[property]['$ref'].replace('#/','').split('/')).properties;
                    const {propertyValue, changedType} = getProperties(ref, '', '', swagger);
                    obj[property].example = ref.example;
                }
            } else {
                switch (obj[property].type) {
                    case 'integer':
                    case 'number':
                        if(obj[property].enum){
                            // is it possible here?
                        } else {
                            properties[property] = 'number';
                            if(!obj[property].example) {
                                if(obj[property].minimum) {
                                    obj[property].example = obj[property].minimum;
                                } else {
                                    obj[property].example = 0;
                                }
                            }
                        }
                        break;
                    case 'string':
                        if(obj[property].enum){
                            const {name, changedType} = createEnum(obj[property].enum, (fupper(key) + fupper(property) + 'Enum'), type);
                            properties[property] = name;
                            type = changedType;
                            if(!obj[property].example) {
                                obj[property].example = obj[property].enum[0];
                            }
                        } else {
                            properties[property] = 'string';
                            if(!obj[property].example) {
                                obj[property].example = 'foo';
                            }
                        }
                        break;
                    case 'boolean':
                        properties[property] = 'boolean';
                        if(!obj[property].example) {
                            obj[property].example = false;
                        }
                        break;
                    case 'array':
                        const {changedProperty, changedType} = switchArray(obj[property].items, key, type, swagger);
                        type = changedType;
                        properties[property] = changedProperty;
                        if(!obj[property].example) {
                            obj[property].example = [obj[property].items.example,obj[property].items.example];
                        }
                        break;
                    case 'object':
                    default:
                        if (obj[property].properties) {
                            if (obj[property].properties['$ref']) {
                                properties[property] = obj[property].properties['$ref'].split('/').pop();
                                if(!obj[property].example) {
                                    const ref = _.get(swagger, obj[property].properties['$ref'].replace('#/','').split('/')).properties;
                                    const {propertyValue, changedType} = getProperties(ref, '', '', swagger);
                                    obj[property].example = ref.example;
                                }
                            } else {
                                const {propertyValue, changedType} = getProperties(obj[property].properties, key, type, swagger);
                                properties[property] = propertyValue;
                                type = changedType;
                                if(!obj[property].example) {
                                    obj[property].example = obj[property].properties.example;
                                }
                            }
                        } else {
                            if (obj[property].type){
                                properties[property] = obj[property].type;
                                if(!obj[property].example) {
                                    obj[property].example = 'foobar';
                                }
                            } else {
                                properties[property] = 'object';
                                if(!obj[property].example) {
                                    obj[property].example = {};
                                }
                            }
                        }
                        break;
                }
            }
            if(!obj.example) obj.example = {};
            obj.example[property] = obj[property].example;
        }
    });
    return {propertyValue: properties, changedType: type};
}

function createEnum(enumArray, name, type) {
    type += `\nexport enum ${name} {
    ${enumArray.join(',\n\t\t')}
}
`;
    return {name, changedType: type};
}

module.exports = {generateTypesFile, getProperties};