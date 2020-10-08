const {fupper} = require("../change-case");

function generateTypesFile(swagger){
    let type = '';
    Object.keys(swagger.definitions).forEach(key => {
        // export interface definitions[i]
        let properties = getProperties(swagger.definitions[key].properties, key, type);
        type += `\nexport interface ${key} ${JSON.stringify(properties, null, 4)}
`;
    });
    return type;
}

// have 200.schema.array.items     properties
// transform it into          type
//
// path method should always return 'type' or $ref
// because it needs to
function switchArray(items) {
    let property = '';
    if (items['$ref']) {
        property = items['$ref'].split('/').pop() + '[]';
    } else {
        switch (items.type) {
            case 'integer':
                property = 'number[]';
                break;
            case 'string':
                property = 'string[]';
                break;
            case 'array':
                property = switchArray(items.items);
                break;
            case 'object':
            default:
                if (items.properties) {
                    if (items.properties['$ref']) {
                        property = items.properties['$ref'].split('/').pop() + '[]';
                    } else {            // TODO prettify it?
                        property = '[' + JSON.stringify(getProperties(items.properties)) + ']';
                    }
                } else {
                    property = items.type + '[]';
                }
                break;
        }
    }
    return property;
}
function getProperties(obj, key, type) {
    let properties = {};
    Object.keys(obj).forEach(property => {
        if(property !== '$ref') if(obj[property]['$ref']) {
            // if ref: status: StatusType
            properties[property] = obj[property]['$ref'].split('/').pop();
        } else {
            switch (obj[property].type) {
                case 'integer':
                    if(obj[property].enum){
                        // is it possible here?
                    } else {
                        properties[property] = 'number';
                    }
                    break;
                case 'string':
                    if(obj[property].enum){
                        properties[property] = createEnum(obj[property].enum, (fupper(key) + fupper(property) + 'Enum'), type);
                    } else {
                        properties[property] = 'string';
                    }
                    break;
                case 'array':
                    properties[property] = switchArray(obj[property].items);
                    break;
                case 'object':
                default:
                    if (obj[property].properties) {
                        if (obj[property].properties['$ref']) {
                            properties[property] = obj[property].properties['$ref'].split('/').pop();
                        } else {
                            properties[property] = getProperties(obj[property].properties, type);
                        }
                    } else {
                        if (obj[property].type){
                            properties[property] = obj[property].type;
                        } else {
                            properties[property] = 'object';
                        }
                    }
                    break;
            }
        }
    });
    return properties;
}

function createEnum(enumArray, name, type) {
    type += `\nexport enum ${name} {
    ${enumArray.join(',\n\t')}
}
`;
    return name;
}

module.exports = {generateTypesFile, getProperties};