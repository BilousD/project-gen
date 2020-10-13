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
            // let payload = swagger.paths[path].get.responses[200]['x-payload'].split('.');
            let payload = 'data'
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
                type = _.get(swagger.paths[path].get.responses[200].schema.properties, payload)['$ref'].split('/').pop();
            }

            const {newItem,controls,columns} = getParametersFromPayload(swagger,type);

            // for imports, i think it uses x-swagger-router-controller for multiple services
            let service = '';
            if(options.frontendProject.oneService) {
                service = 'BasicService';
            } else { // im not sure if its correct
                service = fupper(swagger.paths[path]['x-swagger-router-controller']) + 'Service';
            }

            await exec(`cd ${options.frontendProject.name} && ng generate component ${kebabise(path)}-table --flat`);

            const componentFileData = component(service,type,get,post,put,deleteMethod,path,newItem,columns,controls);
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
        if(param !== '$ref') {
            // TODO change object push to have insides
            switch (swagger.definitions[type].properties[param].type) {
                case 'string':
                    newItem.push(`${param}: ''`);
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
            }
            columns += `makeColumnInfo('${param}', '${fupper(param)}', true, false),`
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
function component(service,type,get,post,put,deleteMethod,path,newItem,columns,controls) {
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
import {${type}} from '../common/types';

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
        options: {  // TODO change ui-lib if needed
          // converterToForm: (v) => {
          //   return {id: v.id, fieldName: v.fieldName, fieldType: v.fieldType};
          //   },
          // converterFromForm: (v) => {
          //   return {id: v.id, fieldName: v.fieldName, fieldType: v.fieldType};
          // },
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