const fs = require('fs');
const {getHeaders, getFrontHeader} = require('./headers')
const getMethods = require('./methods')
const createPackage = require('./create-package')
const {camelize,kebabise,fupper} = require('../change-case');
const {generateTypesFile, getProperties} = require('./manageTypes');
const createComponents = require('./creating-components');
const dockerFile = require("./docker-file");
const createFuncTests = require("./functioonal-tests");

async function generateFiles(swagger, options) {

    createPackage(swagger, options);

    Object.keys(swagger.definitions).forEach(key => { // generate examples
        getProperties(swagger.definitions[key].properties, '', '', swagger);
    });

    let files = {}
    let checkForDuplicates = {};
    Object.keys(swagger.paths).forEach(path => {
        let controller = swagger.paths[path]['x-swagger-router-controller'];
        if (!files[controller]) files[controller] = {
            controllerMethod: '', serviceMethod: '', integrationMethod: '', functionalMethod: '', serviceFront: '',
            headers: {}, frontHeader: '', importTypes: []
        };

        Object.keys(swagger.paths[path]).forEach(method => {
            if (!method.startsWith('x-')) {
                const {controllerMethod, serviceMethod, integrationMethod, functionalMethod, serviceFront, importTypes} = getMethods(swagger, path, method);
                let m = swagger.paths[path][method].operationId;
                checkForDuplicates[`${m}`] ? console.error(`Duplicated method: ${m}`) : checkForDuplicates[`${m}`] = true;

                // TODO change to something better
                files[controller].controllerMethod += controllerMethod;
                files[controller].serviceMethod += serviceMethod;
                files[controller].integrationMethod += integrationMethod;
                files[controller].functionalMethod += functionalMethod;
                if (options.frontendProject.generate) files[controller].serviceFront += serviceFront;
                files[controller].importTypes = files[controller].importTypes.concat(importTypes);
            }
        });
    });

    if (options.frontendProject.generate) {


        if (options.frontendProject.oneService) {
            let importTypes = [];
            let methods = '';
            Object.keys(files).forEach(controller => {
                files[controller].headers = getHeaders(controller);

                // Merging  into one
                importTypes = importTypes.concat(files[controller].importTypes);
                methods += files[controller].serviceFront;
            });
            // remove duplicates
            importTypes = [...new Set(importTypes)];
            // remove 'any' type
            const index = importTypes.indexOf('any');
            if (index > -1) {
                importTypes.splice(index, 1);
            }
            const frontHeader = getFrontHeader(importTypes, swagger.basePath);

            // Writing front service file
            // TODO check for declaration duplication
            const frontServiceFileData = frontHeader + methods + '\n}'
            fs.writeFileSync(`./${options.frontendProject.name}/src/app/basic.service.ts`, frontServiceFileData, 'utf8');
        } else {
            // Writing multiple front service files
            Object.keys(files).forEach(controller => {
                files[controller].headers = getHeaders(controller);
                const frontHeader = getFrontHeader(files[controller].importTypes, swagger.basePath, controller);

                const frontServiceFileData = frontHeader + files[controller].functionalMethod + '\n}\n'
                fs.writeFileSync(`./${options.frontendProject.name}/src/app/${controller}.service.ts`, frontServiceFileData, 'utf8');
            });
        }

        try {
            const generatedTypes = generateTypesFile(swagger).replace(/"*\\*/g, '');
            try {
                fs.mkdirSync(`./${options.frontendProject.name}/src/common`);
            }catch (e) {}
            fs.writeFileSync(`./${options.frontendProject.name}/src/common/types.ts`, generatedTypes, 'utf8');
        } catch (e) {
            console.error('Generating types file write error:');
            console.error(e);
        }

        await createComponents(swagger, options);
    }

    // Writing back files
    Object.keys(files).forEach(controller => {
        // File data = header + methods + }
        const controllerFileData = files[controller].headers.backController + '\n' + files[controller].controllerMethod + '\n}';
        fs.writeFileSync(`./${options.backendProject.name}/src/controllers/${controller}.js`, controllerFileData, 'utf8');

        const serviceFileData = files[controller].headers.backService + '\n' + files[controller].serviceMethod + '\n}\n\n' +
            `const ${camelize(controller)}Db = new ${fupper(camelize(controller))}Db()\nmodule.exports = ${camelize(controller)}Db;`;
        fs.writeFileSync(`./${options.backendProject.name}/src/services/${controller}-db.js`, serviceFileData, 'utf8');

        const integrationFileData = files[controller].headers.integrationTest + '\n' + files[controller].integrationMethod + '\n});'
        fs.writeFileSync(`./${options.backendProject.name}/tests/integration/${controller}-db-test.js`, integrationFileData, 'utf8');

        const functionalFileData = files[controller].headers.functionalTest + '\n' + files[controller].functionalMethod + '\n});'
        fs.writeFileSync(`./${options.backendProject.name}/tests/functional/${controller}-test.js`, functionalFileData, 'utf8');
    });

    createFuncTests(swagger, options);

    // write postgre docker file
    const dockerFileData = dockerFile(options);
    fs.writeFileSync(`./${options.backendProject.name}/devops/docker-compose.yml`, dockerFileData, 'utf8');
}

module.exports = generateFiles;
