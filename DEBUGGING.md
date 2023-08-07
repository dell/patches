# Debugging

- [Debugging](#debugging)
  - [Debugging with VSCode](#debugging-with-vscode)
    - [Debugging the Backend](#debugging-the-backend)
    - [Debugging the Frontend](#debugging-the-frontend)
  - [Debugging Certificates](#debugging-certificates)
  - [Helpful Commands](#helpful-commands)
    - [Determine Which Container Has Target IP](#determine-which-container-has-target-ip)
  - [Helpful Database Commands](#helpful-database-commands)
    - [Dump the Database Schema](#dump-the-database-schema)
    - [List the Databases Available](#list-the-databases-available)
    - [Select a Database](#select-a-database)
    - [List the Tables](#list-the-tables)
    - [Resetting the Database](#resetting-the-database)
  - [Common Errors](#common-errors)
    - [NET::ERR\_CERT\_COMMON\_NAME\_INVALID](#neterr_cert_common_name_invalid)

## Debugging with VSCode

### Debugging the Backend
 
- Create a launch configuration in VSCode. You will need to substitute the address with the machine on which you are running patches. 
 
``` 
{
    "version": "0.2.0",
    "configurations": [
        {      
            "name": "Run Chrome",
            "type": "chrome",
            "request": "launch",
            "url": "https://<SERVER_IP>",
            "webRoot": "${workspaceFolder}",
        },
        {
        "name": "Docker: Attach to Node",
        "type": "node",
        "request": "attach",
        "restart": true,
        "port": 9229,
        "address": "<SERVER_IP>",
        "localRoot": "${workspaceFolder}",
        "remoteRoot": "/home/node/app",
        "protocol": "inspector"
        }
    ]
}
``` 
 
- Edit the `.patches-backend` environment file and change NODE_ENV to development
- Run the below command

```bash
# Set NODE_ENV to development for debug mode
# Start podman in debug mode. Port 9229 is used for debugging
# DEVELOPER NOTE: Notice that here we do two things differently:
# 1. All of the files are mounted into the container instead of being baked in.
# This prevents you from having to rebuild the container on each run of development
# 2. Notice that unlike in production the calls are not made to /home/node/app/server
# But instead go to /home/node/app. This is because we are overwriting the files
# and putting them in the home directory. If you go to server you will get
# the base code instead of the code you are editing on the filesystem.
TOP_DIR=./
SCRIPT_DIR=./podman-build/
CERT_DIRECTORY=./server_certs/
podman rm -f -t 0 patches-backend && \
podman run \
  --name patches-backend \
  --env-file ${TOP_DIR}/.patches-backend \
  --volume ${TOP_DIR}/server/data:/home/node/app/data:Z \
  --volume ${TOP_DIR}/server/routes:/home/node/app/server/routes:Z \
  --volume ${TOP_DIR}/server/db.js:/home/node/app/server/db.js:Z \
  --volume ${TOP_DIR}/server/index.js:/home/node/app/index.js:Z \
  --volume ${TOP_DIR}/server/knexfile.js:/home/node/app/server/knexfile.js:Z \
  --volume ${TOP_DIR}/server/rebuild_database.js:/home/node/app/server/rebuild_database.js:Z \
  --volume ${TOP_DIR}/server/util.js:/home/node/app/server/util.js:Z \
  --volume ${TOP_DIR}/server/seeds/:/home/node/app/server/seeds:Z \
  --volume ${TOP_DIR}/package.json:/home/node/app/package.json:Z \
  --volume ${TOP_DIR}/${CERT_DIRECTORY}:/patches/${CERT_DIRECTORY}:z \
  --volume ${SCRIPT_DIR}/docker-entrypoint-initdb.d:/docker-entrypoint-initdb.d:Z \
  --volume ${TOP_DIR}/migrations:/home/node/app/migrations:Z \
  --volume ${TOP_DIR}/repos/xml:/patches/xml:z \
  --volume ${TOP_DIR}/repos/xml/parsed:/patches/xml/parsed:z \
  --publish "9229:9229" \
  --network host-bridge-net \
  -it \
  localhost/dell/patches-base:latest \
  /bin/bash &&
podman restart patches-nginx
```

- NOTE: YOU MUST RUN `podman restart patches-nginx` for the frontend to work when you do this otherwise nginx will used a cached DNS result for patches-backend which leads to a failure beacuse it will have the incorrect IP address
- Once you are inside the backend container run:
  - Note: I'm not sure why currently, but if you don't run all three commands sequentially like this vscode doesn't appear to bind breakpoints correctly

```
/home/node/app/node_modules/knex/bin/cli.js migrate:rollback --knexfile /home/node/app/server/knexfile.js && node /home/node/app/node_modules/knex/bin/cli.js migrate:latest --knexfile /home/node/app/server/knexfile.js && node --inspect-brk=0.0.0.0:9229 server/index.js
```

- The commands individually are:

```bash
node --inspect-brk=0.0.0.0:9229 /home/node/app/node_modules/knex/bin/cli.js migrate:latest
node --inspect-brk=0.0.0.0:9229 server/index.js --knexfile /home/node/app/server/knexfile.js
# If you want to rollback use /home/node/app/node_modules/knex/bin/cli.js migrate:rollback --knexfile /home/node/app/server/knexfile.js
```

- I have also noticed that in order for breakpoints to trigger I sometimes have to detach the debugger in vscode, kill the program, and rerun.

### Debugging the Frontend

- Use the same debug configuration from the backend (it has the frontend embedded in it)
- Hit play in vscode
- Go back to Patches and run:

```bash
TOP_DIR=./
SCRIPT_DIR=./podman-build/
CERT_DIRECTORY=./server_certs/
FRONTEND_PORT=3000
podman rm -f -t 0 patches-frontend && \
podman run \
  --name patches-frontend \
  --env-file ${TOP_DIR}/.patches-frontend \
  --volume ${TOP_DIR}/src:/home/node/app/src:Z \
  --network host-bridge-net \
  --publish "${FRONTEND_PORT}:${FRONTEND_PORT}" \
  -it \
  localhost/dell/patches-base:latest \
  /bin/bash &&
podman restart patches-nginx
```

- Inside the container run `npm start`
- After everything is started you can either hit port 3000 directly but then API calls won't work. You can hit the regular IP and everything should work as expected.
  - Like the backend, for real testing to work you'll have to restart patches-nginx otherwise it will have the incorrect IP address
  - TODO: Right now I'm having problems with the certificates - the debugger won't attach because it doesn't have a matching cert

## Debugging Certificates

- I created the script [certificate_generator.sh](./etc/certificate_generator.sh) which will create a Certificate Authority (CA) and a client certificate with random distinguished names, sign the client certificate using the CA, and create a PKCS#12 file for the client certificate in the "client" directory. You can use this for created certs to test the import process.

## Helpful Commands

### Determine Which Container Has Target IP

```bash
podman inspect -f '{{.Name}}' $(podman ps -a -q --format='{{.ID}}') | xargs -I {} sh -c 'podman inspect -f "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" {} | grep -w 10.89.0.111 && echo Container: {}'
```

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