#!/usr/bin/env node

const fs = require('fs');
const YAML = require('yaml');
const swaggerSpec = require('swagger-tools').specs.v2_0;
const _ = require('lodash');
const path = require('path');
const generateFiles = require('./creating-files/generate-files');

const util = require('util');
const createConfig = require("./creating-files/create-config-file");
const exec = util.promisify(require('child_process').exec);
const ncp = require('ncp').ncp;
ncp.limit = 16;

async function main() {
    const options = optionsInit();
    const swaggerFile = options.swaggerFile;
    const dbFile = options.databaseFile;
    let parsedSwagger;
    parsedSwagger = parseFromExtension(swaggerFile);

    if (!parsedSwagger) {
        console.error('After parsing, nothing found in swagger object');
        process.exit(1);
    }
    try {
        // Validate swagger file
        await new Promise((resolve, reject) =>
            swaggerSpec.validate(parsedSwagger,  (err, results) => {
                if (err) {
                    //some err occurred
                    reject(err);
                } else {
                    resolve();
                }
        }));
    } catch (e) {
        console.error('Swagger validation error: ',e);
        process.exit(1);
    }
    try {
        // Copy template files
        await new Promise((resolve, reject) => {
            ncp(path.resolve(__dirname, './templates-back'), `./${options.backendProject.name}`, function (err) {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        });
    } catch (e) {
        console.error('Files copy error: ',e);
        process.exit(1);
    }


    // fs.copyFileSync(swaggerFile,`./${options.backendProject.name}/swagger${path.extname(swaggerFile)}`);

    fs.copyFileSync(dbFile,`./${options.backendProject.name}/src/db/db.sql`);

    if(options.frontendProject.generate) {
        // creating project
        console.log('Generating frontend project');
        try {
            await generateAngular(options);
        }catch (err) {
            console.error('Frontend project generation failed:');
            console.error(err);
            process.exit(1);
        }
    }

    // backGen(parsedSwagger, options);
    console.log('Generating files from swagger');
    await generateFiles(parsedSwagger, options);

    try {
        let arg = `cd ${options.backendProject.name} && npm install`;
        await execute('running npm install', options.backendProject.output, arg);
    } catch (err) {
        console.error('Failed to run "npm install"\n')
        console.error(err);
    }

    remP(parsedSwagger);
    if (path.extname(swaggerFile) === '.json') {
        fs.writeFileSync(`./${options.backendProject.name}/swagger.json`, JSON.stringify(parsedSwagger, null, '    ')
        );
    } else {
        fs.writeFileSync(`./${options.backendProject.name}/swagger.yaml`, YAML.stringify(parsedSwagger)
        );
    }
}
function remP(obj) {
    delete obj['x-query'];
    delete obj['x-payload'];
    delete obj['x-path-name'];
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'object') {
            remP(obj[key]);
        }
    });
}

function optionsInit() {
    let arg = process.argv;
    if (arg.length < 3) {
        // TODO change help run
        console.error('Mandatory variables: path to options file\nTo run use: node index ./options.yaml');
        process.exit(1);
    }
    // TODO change default to ...
    // TODO opts.json
    const options = _.merge(parseFromExtension(path.resolve(__dirname,'./options.yaml')), parseFromExtension(arg[2]));
    if (!options.swaggerFile || !options.databaseFile) {
        throw new Error(`Swagger or Database file paths are not specified in options`);
    }

    return options;
}

// generating angular project
async function generateAngular(options) {
    let arg;
    if(options.frontendProject.angularCLI) {
        arg = 'npm install -g @angular/cli';
        await execute('installing @angular/cli', options.frontendProject.output, arg);
    }
    if(options.frontendProject.arguments) {
        arg = `ng new ${options.frontendProject.arguments}`;
    } else {
        arg = `ng new ${options.frontendProject.name} --style ${options.frontendProject.style} --routing ${options.frontendProject.angularRouting}`;
    }
    await execute('Creating angular project', options.frontendProject.output, arg);
    if(options.frontendProject.material) {
        arg = `cd ${options.frontendProject.name} && ng add @angular/material`;
        await execute('installing @angular/material', options.frontendProject.output, arg);
    }

    try {
        // Copy template files
        await new Promise((resolve, reject) => {
            ncp(path.resolve(__dirname, './templates-front'), `./${options.frontendProject.name}`, function (err) {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        });
    } catch (e) {
        console.error('Front files copy error: ',e);
        process.exit(1);
    }

    arg = `cd ${options.frontendProject.name} && npm i ./ui-lib-0.0.1.tgz`;
    await execute('installing ui-lib', options.frontendProject.output, arg);
    arg = `cd ${options.frontendProject.name} && npm i https-proxy-agent`;
    await execute('installing https-proxy-agent', options.frontendProject.output, arg);

    // Changing frontend package.json to include proxy file for backend
    try {
        let packageFile = parseFromExtension(`./${options.frontendProject.name}/package.json`);
        packageFile.scripts.start = "ng serve --host=0.0.0.0 --proxy-config proxy.js";
        fs.writeFileSync(`./${options.frontendProject.name}/package.json`, JSON.stringify(packageFile,null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to write frontend package.json file');
        console.error(e);
    }
    // writing config.js
    try {
        let configFileData = createConfig(options);
        fs.writeFileSync(`./${options.backendProject.name}/config.js`, configFileData, 'utf8');
    } catch (e) {
        console.error('Failed to write frontend config.js file');
        console.error(e);
    }
}

// execute bash command
async function execute(log, output, arg) {
    console.log(log);
    const { stdout, stderr } = await exec(arg);
    if (output) {
        console.log('stdout:', stdout);
    }
    console.log('finished', log);
    if(stderr) console.warn(`${log} execution error:\n`, stderr);
    return {};
}

function parseFromExtension(pathToFile) {
    try {
        switch (path.extname(pathToFile)) {
        case '.json':
            return JSON.parse(fs.readFileSync(pathToFile).toString());
        default:
            return YAML.parse(fs.readFileSync(pathToFile).toString());
        }
    } catch (e) {
        console.error(`ERROR: Failed to parse ${pathToFile}`);
        console.error(e)
        process.exit(1);
    }
}

main().then(() => {});
