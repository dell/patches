# Debugging

- [Debugging](#debugging)
  - [Helpful Database Commands](#helpful-database-commands)
    - [Dump the Database Schema](#dump-the-database-schema)
    - [List the Databases Available](#list-the-databases-available)
    - [Select a Database](#select-a-database)
    - [List the Tables](#list-the-tables)
    - [Resetting the Database](#resetting-the-database)
  - [Common Errors](#common-errors)
    - [NET::ERR\_CERT\_COMMON\_NAME\_INVALID](#neterr_cert_common_name_invalid)

## Helpful Database Commands

### Dump the Database Schema

You can dump the database schema as the `postgres` user with `pg_dump -s patches`

### List the Databases Available

`\l`

### Select a Database

`\c <database_name>`

### List the Tables

`\dt`

### Resetting the Database

You can reset the database by rolling back all the migrations with `./node_modules/knex/bin/cli.js migrate:rollback`. Just keep in mind you will have had to install knex with `npm` to do this. You can then recreate the database with `./node_modules/knex/bin/cli.js migrate:latest`

## Common Errors

### NET::ERR_CERT_COMMON_NAME_INVALID

If your browser returns `NET::ERR_CERT_COMMON_NAME_INVALID` when you try to hit Patches with an IP address this typically means the subject alternative name with the IP address is wrong. The Patches IP address must be present in the cert or you'll see this error. The other reason is that the DNS name isn't present in either the common name or the DNS names in the subject alternate names.