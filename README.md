# Patches

## Dependencies

- Node 14.15.0
- PostgreSQL 12.3

## Postgres Setup

- Install the repository RPM:
  `sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm`

- Disable the built-in PostgreSQL module:
  `sudo dnf -qy module disable postgresql`

- Install PostgreSQL:
  `sudo dnf install -y postgresql12-server`

- Optionally initialize the database and enable automatic start:

```
sudo /usr/pgsql-12/bin/postgresql-12-setup initdb
sudo systemctl enable postgresql-12
sudo systemctl start postgresql-12
```

- `sudo su postgres`
- `psql`
- Create the database, user, and grant them privelages ``

```
CREATE DATABASE patches;
CREATE USER root WITH ENCRYPTED PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE patches TO root;
```

- Exit psql and postgres user by pressing `ctrl + D` twice
- Edit the postgres configuration to accept password authentication
  - `cd /var/lib/pgsql/12/data`
  - `vi pg_hba.conf`
  - Change the method next to "local all all" from peer to trust
  - Change the method next to "host all all 127.0.0.1/32" from ident to trust
  - `systemctl restart postgresql-12`

## Node Setup

- `dnf module list nodejs`
- `dnf module enable nodejs:12`
- `dnf module install nodejs`
- Type `y` and hit enter for all the prompts to install

## Patches Setup

- Extract the package `tar -C /opt -zxvf patches.tar.gz`
- `cd /opt/patches`

## Authentication

This project uses certificates for authentication. The server uses a ca to ensure that all users accessing the application must provide a client certificate. To change which certificates are used on the server, refer to the configuraion steps below.

### Configuration

All configurations for this application use environment variables. To change them do the following

- `vi patches.service` to enter the text editor
- `i` to enter insert mode
- Options:
  - PORT - The port the application will run on
  - SERVER_CA - The full path to the CA file
  - SERVER_CERT - The fullpath to the server SSL cert
  - SERVER_KEY - The fullpath to the server SSL key
  - DATABASE_URL - The postgres URI (format: `[user]:[password]@[host]:5432/patches`)
  - DOWNLOAD_PATH - The path to the Dell RPM files
- `esc` to exit insert mode
- `:q` to exit the editor

### Database Setup

- Run the migrations `./node_modules/knex/bin/cli.js migrate:latest`
  - You should see `Batch 1 run: 1 migrations`
- Add data to the database `./node_modules/knex/bin/cli.js seed:run`
  - You should see `Ran 1 seed files`

## Run Patches

- Copy the service file to systemd `cp /opt/patches/patches.service /etc/systemd/system`
- Enable patches (automatically starts the service on reboot) `systemctl enable patches`
- Start patches `systemctl start patches`
- Open https://[PUBLIC IP]:9000 in browser

## Admin Panel
To access the admin panel you will need to give your account the admin role

- Enter postgres
- `sudo su postgres`
- `psql`
- Run this command replacing your username from your certificate inside the quotations `INSERT INTO user_roles (username, role_id) VALUES ('YOUR USERNAME', 1);`
- Navigate to https://[PUBLIC IP]:9000/admin/dashboard in your browser to access the admin panel

Troubleshooting
- If you're not able to see the admin panel try clearing the site data for patches in your browser to force a log out.
- You can also try opening the chrome inspector and running  `localStorage.clear()` in the javascript console.
- Refresh and log back in with your certificate
