#!/bin/sh

if [ ! -d "/opt" ]; then
  mkdir /opt
fi
tar -C /opt -zxvf patches.tar.gz
current_dir=$(pwd)
mkdir /opt/patches/parsed_data

echo "-----------------------------------------------------------------"
echo "-----------------------------------------------------------------"

read -p "Enter the port the server will listen on for requests (default: 443): " port
if [ -z "$port" ]; then
  port=443 ;
fi

echo "For the Server CA option, if you are loading multiple CAs to be trusted, please put all PEMs in the same directory"
echo "and enter the directory path into the SERVER CA input."
echo "-----------------------------------------------------------------"
echo "-----------------------------------------------------------------"

read -p "Enter the FULL PATH to the SERVER CA directory (if multiple) or the DIRECT PATH to the SERVER CA PEM (default: /opt/patches/cert/rootCA.pem): " server_ca_path
if [ -z "$server_ca_path" ]; then
  server_ca_path="/opt/patches/cert" ;
  mkdir $server_ca_path ;
  cp /opt/patches/server-cert.pem $server_ca_path/ ;
  cp /opt/patches/rootCA.pem $server_ca_path/ ;
  server_ca_path="/opt/patches/cert/rootCA.pem" ;
fi

if [ -d $server_ca_path ]&& echo "Directory ${server_ca_path} doesn't exist, creating" ; then
  mkdir $server_ca_path ;
  echo "${server_ca_path} created, please move your CA file to it"
fi

echo "-----------------------------------------------------------------"
echo "-----------------------------------------------------------------"

read -p "Enter the FULL PATH to the SERVER SSL cert (default: /opt/patches/cert/server-cert.pem): " server_ssl_path
if [ -z "$server_ssl_path" ]; then
  server_ssl_path="/opt/patches/cert/server-cert.pem" ;
fi

if [ -d $server_ssl_path ]&& echo "Directory ${server_ssl_path} doesn't exist, creating" ; then
  mkdir $server_ssl_path ;
  echo "${server_ssl_path} created, please move your SSL file to it" ;
fi

echo "-----------------------------------------------------------------"
echo "-----------------------------------------------------------------"

read -p "Enter the FULL PATH to the SERVER SSL key (default: /opt/patches/cert/server-key.pem): " server_ssl_key
if  [ -z "$server_ssl_key" ]; then
  server_ssl_key="/opt/patches/cert" ;
  cp /opt/patches/server-key.pem $server_ssl_key/ ;
  server_ssl_key="/opt/patches/cert/server-key.pem"
fi

if [ -d $server_ssl_key ]&& echo "Directory ${server_ssl_key} doesn't exist, creating" ; then
  mkdir $server_ssl_key ;
  echo "${server_ssl_key} created, please move your SSL key to it" ;
fi

echo "-----------------------------------------------------------------"
echo "-----------------------------------------------------------------"

read -p "Enter the postgres server URI configuration (format: [user]:[password]@[host]:5432/patches): " postgres_uri
if [ -z "$postgres_uri" ]; then
  postgres_uri="root:password@localhost:5432/patches" ;
fi

echo "-----------------------------------------------------------------"
echo "-----------------------------------------------------------------"

read -p "Enter the path to the Dell RPM top-level-directory containing all repository folders (default: /opt/repos/): " repo_path
if [ -z "$repo_path" ]; then
  repo_path="/opt/repos" ;
  mkdir $repo_path
fi

echo "-----------------------------------------------------------------"
echo "-----------------------------------------------------------------"

if ! systemctl list-units | grep postgresql; then 

  if ! rpm -qa | grep -qw postgresql13-libs-13.4-1PGDG; then
    rpm -i --nosignature "$current_dir"/postgresql13-libs-13.4-1PGDG.rhel8.x86_64.rpm ;
  else
    echo "PostgreSQL-libs-13.4 already installed"; fi
  if ! rpm -qa | grep -qw postgresql13-13.4-1PGDG; then
    rpm -i --nosignature "$current_dir"/postgresql13-13.4-1PGDG.rhel8.x86_64.rpm ;
  else
    echo "PostgreSQL-13.4 already installed"; fi
  if ! rpm -qa | grep -qw postgresql13-server-13.4-1PGDG; then
    rpm -i --nosignature "$current_dir"/postgresql13-server-13.4-1PGDG.rhel8.x86_64.rpm ; 
  else
    echo "PostgreSQL-server already installed"; fi
fi

/usr/pgsql-13/bin/postgresql-13-setup initdb

systemctl enable postgresql-13
systemctl start postgresql-13

su - postgres << EOF
  psql -c "DROP DATABASE patches;"
  psql -c "CREATE DATABASE patches;"
  psql -c "CREATE USER root WITH encrypted password 'password';"
  psql -c "GRANT ALL PRIVILEGES ON DATABASE patches TO root;"
EOF

sudo printf "[Unit]\nDescription=Patches Service\n\n[Service]\nEnvironment=NODE_ENV=production
Environment=PORT=$port\nEnvironment=SERVER_CA=$server_ca_path\nEnvironment=SERVER_CERT=$server_ssl_path
Environment=SERVER_KEY=$server_ssl_key\nEnvironment=DATABASE_URL=$postgres_uri
Environment=REPO_PATH=$repo_path\nEnvironment=PARSED_PATH=/opt/patches/parsed_data\n\nUser=root\nType=simple\nRestart=always\nRestartSec=1
ExecStart=/opt/patches/patches-server.sh\nWorkingDirectory=/opt/patches\n\n[Install]\nWantedBy=multi-user.target" > /opt/patches/patches.service

chmod +x /opt/patches/patches-server.sh
cp /opt/patches/patches.service /etc/systemd/system

systemctl enable patches
systemctl start patches

echo "Sleeping 60 seconds to wait to check status of patches"
sleep 60s

if ! systemctl -q is-active patches.service; then
  echo "Patches failed to start, error output" ;
  journalctl --unit=patches.service -n 50 --no-pager ;
else
  echo "Patches successfully started!";
fi

postgres_uri="postgres://${postgres_uri}"
read -p "Enter the username to use to access the application ADMIN panel (usernames should match the intended users Certificate SUBJECT COMMON NAME): " admin_user
if [ -z "$admin_user" ]; then
  echo "No default admin user created, please use the creation script to create a user"

su - postgres -c "psql ${postgres_uri}" << EOF
  INSERT INTO roles (title) VALUES ('admin');
  INSERT into roles (title) VALUES ('user');
EOF

else

su - postgres -c "psql ${postgres_uri}" <<EOF
  INSERT INTO roles (title) VALUES ('admin');
  INSERT INTO roles (title) VALUES ('user');
  INSERT INTO users (name) VALUES ('${admin_user}');
  INSERT INTO user_roles (username, role_id, updating_user) VALUES ('${admin_user}', 1, 'System');
EOF
fi