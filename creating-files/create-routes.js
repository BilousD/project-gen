const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const {kebabise, fupper, camelize} = require("../change-case");

async function generateRoutes(swagger, options, routes) {
    try {
        // await exec(`cd ${options.frontendProject.name} && ng generate module app-routing --flat --module=app`);
    } catch (e) {
        console.error('Generating router error');
        console.error(e);
    }



    try {
        let routerFileData = getRouterFileData(routes);
        fs.writeFileSync(`./${options.frontendProject.name}/src/app/app-routing.module.ts`, routerFileData, 'utf8');
    } catch (e) {
        console.error('Router writing data error');
        console.error(e);
    }
    try {
        const componentHTMLFileData = getComponentHTMLFileData(routes);
        fs.writeFileSync(`./${options.frontendProject.name}/src/app/app.component.html`, componentHTMLFileData, 'utf8');
    } catch (e) {
        console.error('Component HTML writing data error');
        console.error(e);
    }
    try {
        const moduleFileData = getModuleFileData(routes);
        fs.writeFileSync(`./${options.frontendProject.name}/src/app/app.module.ts`, moduleFileData, 'utf8');
    } catch (e) {
        console.error('App module writing data error');
        console.error(e);
    }
}




function getComponentHTMLFileData(routes) {
    let routesArray = [];
    for (const route of routes) {
        routesArray.push(`<nav>
    <a routerLink="/${kebabise(route)}-table">${fupper(camelize(route))}TableComponent</a>
</nav>`);
    }
    return `<h1>{{title}}</h1>
${routesArray.join('\n')}
<router-outlet></router-outlet>`
}

function getRouterFileData(routes) {
    let routesArray = [];
    let importsArray = [];
    for (const route of routes) {
        routesArray.push(`{ path: '${kebabise(route)}-table', component: ${fupper(camelize(route))}TableComponent }`)
        importsArray.push(`import { ${fupper(camelize(route))}TableComponent } from './${kebabise(route)}-table.component';`);
    }
    return `import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
${importsArray.join('\n')}

const routes: Routes = [ ${routesArray.join(',\n\t')}
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule { }`;
}

function getModuleFileData(routes) {
    let imports = [];
    let componentDeclarations = [];
    for (const route of routes) {
        componentDeclarations.push(`${fupper(camelize(route))}TableComponent`);
        imports.push(`import { ${fupper(camelize(route))}TableComponent } from './${kebabise(route)}-table.component';`);
    }
    return `import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
${imports.join('\n')}
import { AppRoutingModule } from './app-routing.module';
import { UiLibModule } from 'ui-lib';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [
    AppComponent,
    ${componentDeclarations.join(',\n\t')}
  ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        AppRoutingModule,
        UiLibModule,
        HttpClientModule
    ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
`;
}

module.exports = generateRoutes;