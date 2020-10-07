const fs = require('fs');
const {kebabise} = require('../change-case');
function createPackage(swagger, options) {
    if(!swagger.info){
        swagger.info = {};
    }
    let packageJSON = {
        "name": (options.projectInfo.name)?kebabise(swagger.info.title):options.projectInfo.name,
        "version": (options.projectInfo.version)?swagger.info.version:options.projectInfo.version,
        "description": (options.projectInfo.description)?swagger.info.description:options.projectInfo.description,
        "main": "app.js",
        "scripts": {
            "dev": "docker-compose -f devops/docker-compose.yml up --build -d",
            "dev-stop": "docker-compose -f devops/docker-compose.yml down",
            "start": "nodemon --inspect app.js",
            "test-functional": "mocha ./tests/functional/*.js",
            "test-integration": "mocha ./tests/integration/*.js"
        },
        "author": (options.projectInfo.author)?swagger.info.contact:options.projectInfo.author,
        "license": (options.projectInfo.license)?swagger.info.license:options.projectInfo.license,
        "dependencies": {
            "connect": "^3.7.0",
            "lodash": "^4.17.20",
            "pg": "^8.3.3",
            "pino": "^6.6.1",
            "swagger-tools": "^0.10.4",
            "yaml": "^1.10.0"
        },
        "devDependencies": {
            "@hapi/code": "^8.0.1",
            "axios": "^0.19.2",
            "mocha": "^7.1.1",
            "nodemon": "^2.0.2"
        }
    } // TODO use npm init
    fs.writeFileSync(`./${options.backendProject.name}/package.json`, JSON.stringify(packageJSON, null, 4), 'utf8');
}
module.exports = createPackage;