function generateTypesFile(swagger){
    let type = '';
    Object.keys(swagger.definitions).forEach(key => {
        // export interface definitions[i]
        let properties = getProperties(swagger.definitions[key].properties);
                                    // was {}Type
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
function getProperties(obj) {
    let properties = {};
    Object.keys(obj).forEach(property => {
        if(property !== '$ref') if(obj[property]['$ref']) {
            // if ref: status: StatusType
            properties[property] = obj[property]['$ref'].split('/').pop();
        } else {
            switch (obj[property].type) {
                case 'integer':
                    properties[property] = 'number';
                    break;
                case 'string':
                    properties[property]= 'string';
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
                            properties[property] = getProperties(obj[property].properties);
                        }
                    } else {
                        properties[property] = 'object';
                    }
                    break;
            }
        }
    });
    return properties;
}


module.exports = {generateTypesFile, getProperties};