# project-gen
Generate nodejs and angular project from swagger file

Start with `node index OPTIONS_FILE`

##### Options file
can be .yaml or .json
yaml example:
``` yaml
# path to swagger file, example: "swaggerFile: ./swagger.yaml"
swaggerFile:
# path to database file, example: "databaseFile: ./db.sql"
databaseFile:
backendProject:
    # When false, skips creation of frontend project
    generate: true
    name: backend
    # redirects angular process output, instead of dumping it
    output: false
frontendProject:
    # When false, skips creation of frontend project
    generate: true
    # When true, installs globally @angular/cli
    # @angular/cli required for generation of frontend project
    angularCLI: false

    # The name of the new workspace and initial project.
    name: frontend
    # When true, generates a routing module for the initial project.
    angularRouting: false
    # The file extension or preprocessor to use for style files.
    style: css
    # arguments for 'ng new' command, overrides other arguments, consider using this with "output: true"
    # arguments: '--help'
    # Redirects angular process output, instead of dumping it

    output: true
    # When true, installs @angular/material
    material: true
    # When false, multiple services will be created, based on 'x-swagger-router-controller'
    oneService: true
# package.json information. When "inSwagger: true", takes information from swagger file, but editing is needed
projectInfo:
    name:
    version:
    description:
    author:
    license:
    ```
