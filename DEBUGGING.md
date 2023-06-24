# Debugging

- [Debugging](#debugging)
  - [Debugging with VSCode](#debugging-with-vscode)
  - [Helpful Database Commands](#helpful-database-commands)
    - [Dump the Database Schema](#dump-the-database-schema)
    - [List the Databases Available](#list-the-databases-available)
    - [Select a Database](#select-a-database)
    - [List the Tables](#list-the-tables)
    - [Resetting the Database](#resetting-the-database)
  - [Common Errors](#common-errors)
    - [NET::ERR\_CERT\_COMMON\_NAME\_INVALID](#neterr_cert_common_name_invalid)

## Debugging with VSCode 
 
1. Create a launch configuration in VSCode. You will need to substitue the address with the machine on which you are running patches. 
 
``` 
{ 
    "version": "0.2.0", 
    "configurations": [ 
      { 
        "name": "Docker: Attach to Node", 
        "type": "node", 
        "request": "attach", 
        "restart": true, 
        "port": 9229, 
        "address": "192.168.1.152", 
        "localRoot": "${workspaceFolder}", 
        "remoteRoot": "/home/node/app", 
        "protocol": "inspector" 
      } 
    ] 
  } 
``` 
 
2. Once you have `launch.json` made run the code with `podman-build/patches <setup|start|stop> --debug` to run the code in debug mode. 
3. **WARNING** As a pseudo disgusting hack, I have been going into the docker-compose file and progressively deleting each phase of the `command` directive as I get it working. I have not figured out how to get the bugger to successfully detach and reattach using the `&&` or `;` directives 
   1. TODO - figure out how I'm going to deconflict with the frontend 
   2. TODO - make a note about using the `debug` command in javascript 

I have also noticed that in order for breakpoints to trigger I sometimes have to detach the debugger in vscode, kill the program, and rerun.

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