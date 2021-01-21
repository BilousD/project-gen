const fs = require('fs');
const _ = require('lodash');
function createFuncTests(swagger, options) {
    for (const path of Object.keys(swagger.paths)) {
        let del = _.get(swagger.paths, [path, 'delete']);
        if (!del) continue;
        // if delete is /path/{id}, insert should be /path, could fail if it is something like /path/{id}/subpath
        let insert = _.get(swagger.paths, [path.replace(/\/{\w*}/, ''), 'post']);
        let insertPath = path.replace(/\/{\w*}/, '');
        if (!insert) {
            let r = search(swagger, path, 'post');
            insert = r.m;
            insertPath = r.path;
        }
        if (!insert) continue;

        let update = _.get(swagger.paths, [path, 'put']);
        let updatePath = path;
        if (!update) {
            let r = search(swagger, path, 'put');
            update = r.m;
            updatePath = r.path;
        }
        let get = _.get(swagger.paths, [path.replace(/\/{\w*}/, ''), 'get']);
        let getPath = path.replace(/\/{\w*}/, '');
        if (!get) {
            let r = search(swagger, path, 'get');
            get = r.m;
            getPath = r.path;
        }
        createFile(swagger, options, insert, insertPath, get, getPath, update, updatePath, del, path);
    }
}

function search(swagger, path, method) {
    // TODO use x-swagger-router-controller for searching (check only those paths that has similar ...)
    let m;
    while (!(m || path.length < 1)) {
        path = path.split('/');
        path.pop();
        path = path.join('/');
        m = _.get(swagger.paths, [path, method]);
        if (!m) {
            Object.keys(swagger.paths).forEach(p => {
                if (p.startsWith(path)) {
                    m = _.get(swagger.paths, [p, method]);
                }
            });
        }
    }
    return {m, path};
}

function getDefinition(swagger, ref) {
    try {
        return swagger.definitions[ref.split('/')[2]];
    } catch (e) {
        console.error(e);
        return {properties: {'x-generated-example': {}}};
    }
}

function updateParam(param, offset) {
    let k;
    if (offset) {
        let arr = Object.keys(param);
        if (arr.length < offset) {
            return `${arr[0]} = {}`;
        }
        k = arr[arr.length - offset];
    } else {
        offset = 0;
        k = _.last(Object.keys(param));
    }

    switch(typeof param[k]) {
        case "number":
            return `${k} = ${param[k] + 1}`;
        case "boolean":
            return `${k} = true`;
        case "string":
            return `${k} = ${param[k]}bar`;
        case "undefined":
            return `${k} = 'defined'`;
        case "object":
            return updateParam(param, offset + 1);
    }
}

function failUpdate(update, path, param) {
    if (path.endsWith('}')) {
        return `            await api.put(\`${path}\${'absent'}\`, p);`;
    }
    let id;
    for(let k of Object.keys(param)) {
        if (k.match(/id/gi)) {
            id = k;
            break;
        }
    }
    return `            p.${id} = 'absent';`;
}

function createFile(swagger, options, insert, insertPath, get, getPath, update, updatePath, del, deletePath) {
    // TODO get ref from other sources if not found here, or check for ref when searching for insert
    let ref = _.get(insert, 'parameters[0].schema[$ref]');
    let param = getDefinition(swagger, ref).properties['x-generated-example'];
    let head = `const _ = require('lodash');
const Code = require('@hapi/code');
const expect = Code.expect;
const utils = require('./utils');
const api = require('axios').create({
    baseURL: 'http://localhost:3000/api/v1',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer cdcba59b-7701-4322-ad57-bf86b927f218'
    }
});
 describe('Test banner controller',()=>{
    const param = ${JSON.stringify(param)};
    it('addBanner', async ()=>{
        let result = await api.post('${insertPath}',param);
        result = result.data;
        param.id = result.data.id;
        expect(param.id).be.string();
    });`
    let middleGet = '';
    if (get) middleGet = `    it('getBanners', async ()=>{
        ////////////////////////////////////////////////////////////////////////let result = await api.get('${getPath}');
        result = result.data.data;
        expect(result).to.equals([param]);
    });`;
    let middleUpdate = '';
    if (update) middleUpdate = `    it('updateBanner', async ()=>{
        param.${updateParam(param)};
                                
        //////////////////////////////////////////////////////////////////let result = await api.put(\`${updatePath}\${param.id}\`,param);
        result = result.data.data;
        expect(result).to.equal({id: param.id});
        result = await api.get('\${getPath}');
        result = result.data.data;
        expect(result).to.equals([param]);
    });
    it('updateBanner negative', async ()=>{
        try{
            const p = _.cloneDeep(param);
            ${failUpdate(update, updatePath, param)}
            throw new Error();
        } catch (e) {
            let response = e.response;
            expect(response.status).to.equal(404);
            expect(response.data).to.equal({status:404, details:{}, message: \`${update.operationId} [\${\${parameters}}] not found\`});
        }
    });`;
    let bottom = `    it('deleteBanner', async ()=>{
        let result = await api.delete(\`${deletePath}\${param.id}\`,);
        result = result.data.data;
        expect(result).to.equal({id:param.id});
    });
    it('deleteBanner negative', async ()=>{
        try{
            await api.delete('${deletePath.replace(/{w*}/)}/absent');
            throw new Error();
        } catch (e) {
            let response = e.response;
            expect(response.status).to.equal(404);
            expect(response.data).to.equal({status:404, details:{}, message: \`${del.operationId} [\${\${parameters}}] not found\`});
        }
    });

});
`;
    const functionalFileData = head + middleGet + middleUpdate + bottom;
    fs.writeFileSync(`./${options.backendProject.name}/tests/functional/${del['x-swagger-router-controller']}-better-test.js`, functionalFileData, 'utf8');
}
module.exports = createFuncTests;
