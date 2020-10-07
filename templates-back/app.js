const fs = require('fs');
const http = require('http');
const app = require('connect')();
const swaggerTools = require('swagger-tools');
const YAML = require('yaml');
const parsedSwagger = YAML.parse(fs.readFileSync('./swagger.yaml').toString());
const log = require('./log').getLogger('APP.MAIN');
const pgPool = require('./src/db/pg-pool');

const serverPort = 3000;

// swaggerRouter configuration
const options = {
    controllers: './src/controllers',
    useStubs: process.env.NODE_ENV === !!'development' // Conditionally turn on stubs (mock mode)
};


function initSwagger(parsedSwagger) {
    return new Promise((resolve, reject)=>{
        swaggerTools.initializeMiddleware(parsedSwagger, function (middleware) {
            resolve(middleware);
        });
    });
}
async function main() {
    // Start DB
    await pgPool.init();
    const middleware = await initSwagger(parsedSwagger);
    // Initialize the Swagger middleware
    log.debug('initializing swagger middleware');
    // Interpret Swagger resources and attach metadata to request - must be first in swagger-tools middleware chain
    app.use(middleware.swaggerMetadata());

    // Validate Swagger requests
    // UNCOMMENT FOR SWAGGER VALIDATIONS
    // app.use(middleware.swaggerValidator());

    // Route validated requests to appropriate controller
    app.use(middleware.swaggerRouter(options));

    // Serve the Swagger documents and Swagger UI
    app.use(middleware.swaggerUi());
    log.info('Web application collected');
    // Start the server
    http.createServer(app).listen(serverPort, function () {
        log.info('Your server is listening on port %d (http://localhost:%d)', serverPort, serverPort);
    });
}
main().then(r => {});
