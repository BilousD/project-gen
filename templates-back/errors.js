class HttpCodeError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.code = code;
        this.details = details;
    }
    getCode() {
        return this.code;
    }
    getDetails() {
        return this.details;
    }
}
function writeResponseError(res, err) {
    let code = 500;
    let details = {};
    if(err && typeof err.getCode === 'function') {
        code = err.getCode();
        details = err.getDetails();
    }
    res.writeHead(code, {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'});
    res.end(JSON.stringify({status: code, details, message: err.message}));
}

module.exports = {HttpCodeError, writeResponseError};
