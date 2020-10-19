const {kebabise, fupper, camelize} = require("../change-case");
const _ = require('lodash');
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const generateRoutes = require('./create-routes');

async function createComponents(swagger, options) {
    let routes = [];
    for (const path of Object.keys(swagger.paths)) {
        let get = _.get(swagger.paths, [path,'get','operationId']);
        // skip GET with parameters, because it is most likely NOT something that should be displayed in a table
        if(!(_.last(path) === '}') && get && !get.parameters) {
            get = `this.service.${get}()`
            const {post,put,deleteMethod} = getServiceMethods(swagger,path);

            let type = '';
            let importType = '';
            let payload = _.get(swagger.paths, `[${path}].get.responses[200][x-payload]`, '').split('.');

            // let payload = 'data'
            if(swagger.paths[path].get.responses[200])
            if(swagger.paths[path].get.responses[200].schema['$ref']){
                let obj = _.get(swagger, swagger.paths[path].get.responses[200].schema['$ref'].replace('#/', '').split('/'));
                // change, because somewhere in path could be $ref
                obj = _.get(obj.properties, payload);
                switch(obj.type) {
                    case 'array':
                        if(obj.items['$ref']) {
                            type = obj.items['$ref'].split('/').pop();
                        } else if(obj.items.properties) {
                            type = obj.items.properties['$ref'].split('/').pop();
                        } else {
                            console.error('ERROR!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                        }
                        break;
                    case 'object':
                        type = obj.properties['$ref'].split('/').pop();
                        break;
                    default:
                        type = obj['$ref'].split('/').pop();
                }
            } else { // TODO check this path
                // TODO there could be a lot of errors
                switch (swagger.paths[path].get.responses[200].schema.type) {
                    case 'object':
                        if(swagger.paths[path].get.responses[200].schema.properties) {
                            type = _.get(_.get(swagger.paths[path].get.responses[200].schema.properties, payload), '[$ref]', 'object').split('/').pop();
                        } else {
                            type = 'object';
                        }
                        break;
                    case 'array':
                        if(swagger.paths[path].get.responses[200].schema.items){
                            type = _.get(swagger.paths[path].get.responses[200].schema.items, '[$ref]', 'array').split('/').pop();
                        } else {
                            type = 'array';
                        }
                        break;
                    default:
                        type = swagger.paths[path].get.responses[200].schema.type;
                }
            }

            let o = {};
            importType = type;
            switch (type) {
                case '':
                    type = '[]';
                    o.newItem = [];
                    o.columns = '';
                    o.controls = '';
                    importType = '';
                    break;
                case 'array':
                    type = '[]';
                case 'object':
                case 'string':
                case 'number':
                    o.newItem = [];
                    o.columns = '';
                    o.controls = '';
                    importType = '';
                    break;
                default:
                    try {
                        o = getParametersFromPayload(swagger,type);
                    } catch (e) {
                        console.error(`\nERROR! Failed to get parameters for components, received type ${type}`)
                        console.error(e)
                        o.newItem = [];
                        o.columns = '';
                        o.controls = '';
                        importType = '';
                    }
            }

            // for imports, i think it uses x-swagger-router-controller for multiple services
            let service = '';
            if(options.frontendProject.oneService) {
                service = 'BasicService';
            } else { // im not sure if its correct
                service = fupper(swagger.paths[path]['x-swagger-router-controller']) + 'Service';
            }

            try {
                await exec(`cd ${options.frontendProject.name} && ng generate component ${kebabise(path)}-table --flat`);
            } catch (e) {
                console.error('Generating components with ng error, could be something not very important\n\n')
                console.error(e)
            }
            const componentFileData = component(service,type,get,post,put,deleteMethod,path,o.newItem,o.columns,o.controls,importType);
            fs.writeFileSync(`./${options.frontendProject.name}/src/app/${kebabise(path)}-table.component.ts`, componentFileData, 'utf8');

            const htmlFileData = getHTML();
            fs.writeFileSync(`./${options.frontendProject.name}/src/app/${kebabise(path)}-table.component.html`, htmlFileData, 'utf8');

            routes.push(`${path}`);
        }
    }
    await generateRoutes(swagger, options, routes);
}

// type <= response[200] type or $ref?
// type can be possibly taken from
// swagger.paths[path].get.responses[200].schema => $ref => swagger.definitions.Type => .payload.split('.') => type
//                                               => .payload.split('.') => type
// let recursion;
// function recurse(object, recursePath) { // TODO same as in methods.js
//     for (let i = 0; i < recursePath.length; i++) {
//         object = object[recursePath[i]];
//     }
//     return object;
// }




function getParametersFromPayload(swagger, type) {   // type should be already  added to parsed swagger object
    // x-payload: 'data'
    // newItem is a new blank item created with current Type
    let newItem = [];
    // columns is visible columns in created table
    let columns = '';
    // controls is (probably) forms for creating or updating items
    let controls = '';
    // type from payload    payload='data' => response[200][$ref] = PetsType => PetsType.data => type
    Object.keys(swagger.definitions[type].properties).forEach(param => {
        if(param !== '$ref' && param !== 'example') {
            // TODO change object push to have insides
            // TODO change 'example', use generated examples
            switch (swagger.definitions[type].properties[param].type) {
                case 'string':
                    if(swagger.definitions[type].properties[param].enum) {
                        newItem.push(`${param}: 0`);
                    } else {
                        newItem.push(`${param}: ''`);
                    }
                    break;
                case 'boolean':
                    newItem.push(`${param}: false`);
                    break;
                case 'integer':
                    newItem.push(`${param}: 0`);
                    break;
                case 'array':
                    newItem.push(`${param}: []`);
                    break;
                case 'object':
                    newItem.push(`${param}: {}`);
                    break;
                default:
                    if(swagger.definitions[type].properties[param]['$ref']) {
                        let o = _.get(swagger, swagger.definitions[type].properties[param]['$ref'].replace('#/', '').split('/'));
                        newItem.push(`${param}: ${JSON.stringify(o.properties.example)}`);
                    }
            }
            columns += `makeColumnInfo('${param}', '${fupper(param)}', true, false),\n`
            let config = 'inputFieldConfiguration(EnumInputType.text)';
            if(swagger.definitions[type].properties[param].type === 'object') {
                config = 'textareaFieldConfiguration()';
            }
            controls += `{
    formControl: BuilderFieldControlConfiguration.${config},
    controlName: '${param}',
    hint: 'Please, input ${param}',
    title: '${fupper(param)}',
    placeholder: 'There is unique ${param}',
    required: true,
    matFormFieldClass: 'field-class',
    immutable: true,
},
`
        }
    });
    return {newItem,columns,controls}
}

//


// how to separate 'path' and 'path/{id}'?
// if(_.last(path) === '}')    skip
// skip other ?
// only '/path' but skip everything like '/path/anytingelse' ?
// (probably) only '/path' has GET that returns an array
// /store/inventory has one

// search for other methods by "tags" and path
// operations
function getServiceMethods(swagger, path) {
    // Found something to display
    let post = _.get(swagger.paths, [path,'post','operationId']);
    // If current path doesn't have post method, upper path level could have it     ???
    if(!post) {
        // search somewhere POST
        // if still not found
        post = 'new Observable(subscriber => { subscriber.complete() })'
    } else {
        // TODO put something in brackets everywhere
        post = `this.service.${camelize(post)}()`;
    }

    let put = _.get(swagger.paths, [path,'put','operationId']);
    if(!put) { // if no put, use post
        put = post;
    } else {
        put = `this.service.${camelize(put)}()`;
    }

    let deleteMethod = _.get(swagger.paths, [path,'delete','operationId']);
    if (!deleteMethod) { // probably always true
        // check for '/path/something'
        // TODO change search, because it can be something like '/pet/delete-something-else', but delete '/pet/{id}' present
        deleteMethod = _.get(swagger.paths, [_.findKey(_.pickBy(swagger.paths,
            (value, key) => key.startsWith(path+'/{')), 'delete')
            ,'delete','operationId']);

    }
    // if no delete found after searching
    if(!deleteMethod) {
        deleteMethod = 'new Observable(subscriber => { subscriber.complete() })';
    } else {
        deleteMethod = `this.service.${camelize(deleteMethod)}()`;
    }
    return {post,put,deleteMethod};
}

// one component per path.get (  /path/{id}  should not get new component  )
// TODO HOW TO GET  "DELETE INSERT UPDATE SELECT"  if only  "get, post" is present in /path/ , and what needed is in /path/{id}
// TODO remove {id} with regex => what is needed, but cant call it
// TODO loop through paths, if on '/{\w}/g' remove same as our path (with removed in case when path/{}/otherpath)

// TODO Observable types for delete, insert, update
// TODO change getId
function component(service,type,get,post,put,deleteMethod,path,newItem,columns,controls,importType) {
    // square bracket for my ide
    const squareBracket = '<';

return `import {Component, OnInit} from '@angular/core';
import {
  BuilderFieldControlConfiguration,
  EditTableConfiguration,
  EnumInputType,
  makeColumnInfo,
  ObservableWithRefresh,
  UIDataSource
} from 'ui-lib';
import {${service}} from './basic.service';
import {MatDialog} from '@angular/material/dialog';
import {Observable} from 'rxjs';
// from x-payload
import {${importType}} from '../common/types';

class DataSource implements UIDataSource${squareBracket}${type}>{
  observable: ObservableWithRefresh${squareBracket}${type}>;
                            // depends on option.oneService
  constructor(private service: ${service}) {                  // depends on /path/get 
    this.observable = new ObservableWithRefresh${squareBracket}${type}>(${get});
  }

  delete(rows: ${type}[]): Observable${squareBracket}any> {
                    // /path/ delete
    return ${deleteMethod};
  }

  insert(row: ${type}): Observable${squareBracket}any> {
                    // /path/ post
    return ${post};
  }

  select(filter?: any): Observable${squareBracket}${type}[]> {
    return this.observable;
  }

  update(row: ${type}): Observable${squareBracket}any> {
                        // /path/ put
    return ${put};
  }

  refresh(): void {             // same as in constructor
    this.observable.newSource(${get});
  }
}

@Component({
  selector: 'app-${kebabise(path)}-table',
  templateUrl: './${kebabise(path)}-table.component.html',
  styleUrls: ['./${kebabise(path)}-table.component.css'] // TODO change to ...
})
export class ${fupper(camelize(path))}TableComponent implements OnInit {
  tableConfiguration: EditTableConfiguration${squareBracket}${type}>;

  constructor(public dialog: MatDialog, private service: ${service}) { }

  ngOnInit(): void {
    this.tableConfiguration = {
      readonly: false,
      dataSource: new DataSource(this.service),
                        // x-payload => everything in type TODO if object or array or number change to corresponding blanks
      newItem: () => ({${newItem.join(', ')}}),
      // TODO change to ... ?
      getId: (r) => '' + r.id,
      getColumnValue: (element, column) => {
        return element[column];
      },
      allColumns: [ ${columns} ],
        
      formConfiguration: {
        options: {
          readonly: false,
          appearance: 'standard',
          formClass: 'form-class'
        },
        controls: [ ${controls} ]        
        },
      extendCommands: null,
      selectedRows: null
    };
    }

}
`;
}
function getHTML() {
    return `<div>
  <lib-edit-table [configuration]="tableConfiguration"></lib-edit-table>
</div>
`;
}

module.exports = createComponents;