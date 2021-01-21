const fs = require('fs');
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
        createFile(insert, insertPath, get, getPath, update, updatePath, del, path, options);
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

/**
 * tests should be:
 * insert
 * update-get
 * delete
 *
 * tests should not be without:
 * insert (cant update, get or delete without something)
 * delete (cant test database leaving junk)
 *
 * its okay to not insert, but really bad to not delete
 * so testing should be only if it has delete function
 */

function getDefinition(swagger, ref) {
    return swagger.definitions[ref.split('/')[2]];
}

function createFile(insert, insertPath, get, getPath, update, updatePath, del, deletePath, options) {
    let param = getDefinition(insert.parameters[0].schema['$ref']).properties['x-generated-example'];
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
    const param = ${param};
    const lObj = [];
    after(async()=>{
        for(const id of lObj) {
            await api.delete(\`/files/\${id}\`);
        }
    });
    it('addBanner', async ()=>{
                                const refId = await utils.saveLargeObject('Hello World!');              ???
                                lObj.push(refId);
                                param.ref.refId = refId;
                                param.ref.mimeType = 'text/plain';
        let result = await api.post('${insertPath}',param);
        result = result.data;
        param.id = result.data.id;
        expect(param.id).be.string();
    });`
    let middleGet = '';
    if (get) middleGet = `    it('getBanners', async ()=>{
        let result = await api.get('${getPath}'); ------------------------------------------  add id if requires, but often should be getAll
        result = result.data.data;
        expect(result).to.equals([param]);
    });`;
    let middleUpdate = '';
    if (update) middleUpdate = `    it('updateBanner', async ()=>{
                    param.score = 1;        change param to something
                    param.lang = 'en';
                                const refId = await utils.saveLargeObject('Hello World 2!!');
                                lObj.push(refId);
                                param.ref.refId = refId;
                                
        let result = await api.put(\`${updatePath}\${param.id}\`,param); ------------------------------------ path should have id in it, but if not - id is in body need to use param.id
        result = result.data.data;
        expect(result).to.equal({id: param.id});
        result = await api.get('\${getPath}');
        result = result.data.data;
        expect(result).to.equals([param]);
    });
    it('updateBanner negative', async ()=>{
        try{
                                                            const p = _.cloneDeep(param);
                                                            p.id = 'absent';
            await api.put(\`${updatePath}\${'absent'}\`,p);  ------------------------------------ path should have id in it, but if not - id is in body need to change param.id
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
