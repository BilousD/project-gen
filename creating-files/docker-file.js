function dockerFile(options) {
    return `version: '3'
services:
  postgres:
    image: postgres:10-alpine
    environment:
      - POSTGRES_USER=${options.dbInfo.user}
      - POSTGRES_DB=${options.dbInfo.dbName}
      - POSTGRES_PASSWORD=${options.dbInfo.dbPassword}
    ports:
      - '5432:5432'
    expose:
      - '5432'
volumes:
  pgadmindata:
`
}
module.exports = dockerFile;