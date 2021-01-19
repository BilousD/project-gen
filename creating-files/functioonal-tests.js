function createFuncTests(swagger, options) {
    for (const path of Object.keys(swagger.paths)) {
        let del = _.get(swagger.paths, [path,'delete']);
        if (!del) continue;
        // if delete is /path/{id}, insert should be /path, could fail if it is something like /path/{id}/subpath
        let insert = _.get(swagger.paths, [path.replace(/\/{\w*}/, ''), 'post']);
        if (!insert) {
            insert = search(swagger, path, 'post');
        }
        if (!insert) continue;

        let update = _.get(swagger.paths, [path, 'put']);
        if (!update) {
            update = search(swagger, path, 'put');
        }
        let get = _.get(swagger.paths, [path.replace(/\/{\w*}/, ''), 'get']);
        if (!get) {
            get = search(swagger, path, 'get');
        }
    }
}

function search(swagger, path, method) {
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
    return m;
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

let something = {id:'',score:0,lang:'uk',ref:{refId:'',targetUrl:'foo',tooltip:'foo'}};
something = getDefinition(insert.parameters[0].schema['$ref']).properties['x-generated-example'];
let a = `const _ = require('lodash');
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
    const param = ${something};
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
        let result = await api.post('${postPath}',param);
        result = result.data;
        param.id = result.data.id;
        expect(param.id).be.string();
    });
    it('getBanners', async ()=>{
        let result = await api.get('${getPath}'); ------------------------------------------  add id if requires, but often should be getAll
        result = result.data.data;
        expect(result).to.equals([param]);
    });
    it('updateBanner', async ()=>{
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
            expect(response.data).to.equal({status:404, details:{}, message: \`\${method.operationId} [\${\${parameters}}] not found\`});
        }
    });
    it('deleteBanner', async ()=>{
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
            expect(response.data).to.equal({status:404, details:{}, message: \`\${method.operationId} [\${\${parameters}}] not found\`});
        }
    });

});
`;
module.exports = createFuncTests;
