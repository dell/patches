# Debugging

1. Run `npm install express`
2. You will need a miniture CA to test with. See https://devopscube.com/create-self-signed-certificates-openssl/
   1. `mkdir server_certs && cd server_certs`
   2. This will create the CA certs. We will use the rootCA.keyand rootCA.crt to sign the SSL certificate for our server. Replace demo.mlopshub.com with your domain name or IP address.

        ```
        openssl req -x509 \
                    -sha256 -days 356 \
                    -nodes \
                    -newkey rsa:2048 \
                    -subj "/CN=demo.mlopshub.com/C=US/L=San Fransisco" \
                    -keyout rootCA.key -out rootCA.crt 
        ```            

   3. Create the server private key: `openssl genrsa -out server.key 2048`
   4. We will create a csr.conf file to have all the information to generate the CSR. Replace demo.mlopshub.com with your domain name or IP address.

        ```
        cat > csr.conf <<EOF
        [ req ]
        default_bits = 2048
        prompt = no
        default_md = sha256
        req_extensions = req_ext
        distinguished_name = dn

        [ dn ]
        C = US
        ST = California
        L = San Fransisco
        O = MLopsHub
        OU = MlopsHub Dev
        CN = demo.mlopshub.com

        [ req_ext ]
        subjectAltName = @alt_names

        [ alt_names ]
        DNS.1 = demo.mlopshub.com
        DNS.2 = www.demo.mlopshub.com
        IP.1 = 192.168.1.5
        IP.2 = 192.168.1.6

        EOF
        ```

   5. Now we will generate server.csr using the following command. `openssl req -new -key server.key -out server.csr -config csr.conf`
   6. Execute the following to create cert.conf for the SSL certificate. Replace demo.mlopshub.com with your domain name or IP address.

        ```
        cat > cert.conf <<EOF

        authorityKeyIdentifier=keyid,issuer
        basicConstraints=CA:FALSE
        keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
        subjectAltName = @alt_names

        [alt_names]
        DNS.1 = demo.mlopshub.com

        EOF
        ```
   7. Now, execute the following command to generate the SSL certificate that is signed by the rootCA.crt and rootCA.key created as part of our own Certificate Authority. This command will generate server.crt that will be used with our server.key to enable SSL in applications.

        ```
        openssl x509 -req \
            -in server.csr \
            -CA rootCA.crt -CAkey rootCA.key \
            -CAcreateserial -out server.crt \
            -days 365 \
            -sha256 -extfile cert.conf
        ```

   8. For example, the following config shows the Nginx config using the server certificate and private key used for SSL configuration.

        ```
        server {

        listen   443;

        ssl    on;
        ssl_certificate    /etc/ssl/server.crt;
        ssl_certificate_key    /etc/ssl/server.key;

        server_name your.domain.com;
        access_log /var/log/nginx/nginx.vhost.access.log;
        error_log /var/log/nginx/nginx.vhost.error.log;
        location / {
        root   /home/www/public_html/your.domain.com/public/;
        index  index.html;
        }

        }
        ```

## Setting Environment Variables

For any of the manual processes listed in the README you will have to populate any of the environment variables listed manually. This would usually be done by the services file but for manual commands the service file's environment isn't available.

```
export NODE_ENV=development
export DATABASE_URL='root:password@http://127.0.0.1:5432/patches'
export SERVER_CERT='/opt/patches/server_certs/server.crt'
export SERVER_KEY='/opt/patches/server_certs/server.key'
export SERVER_CA='/opt/patches/server_certs/rootCA.crt'
export DOWNLOAD_PATH=/opt/patches/download
export XML_PATH=/opt/patches/xml
export PARSED_PATH=/opt/patches/xml/parsed
export REPO_PATH=/opt/patches/xml/
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
