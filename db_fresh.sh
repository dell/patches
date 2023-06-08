echo "Running this script will delete all patches data and rebuild the db to a base configuration"
read -p "Do you wish to proceed? (Y/N) " answer
if [ "$answer" == "Y" ] || [ "$answer" == "y" ] ; then

systemctl stop patches
rm -r /opt/patches/migrations
rm -r /opt/caxa
mkdir /opt/patches/migrations
cp 20200330095735_init.js /opt/patches/migrations
cp patches-server.sh /opt/patches/patches-server.sh
chmod +x /opt/patches/patches-server.sh

su - postgres << EOF
  psql -c "DROP DATABASE patches;"
  psql -c "CREATE DATABASE patches;"
  psql -c "GRANT ALL PRIVILEGES ON DATABASE patches TO root;"
EOF

postgres_uri="postgres://root:password@localhost:5432/patches"

systemctl start patches

echo "Sleeping 60 seconds to wait to check status of patches"
sleep 60s

if ! systemctl -q is-active patches.service; then
  echo "Patches failed to start, error output" ;
  journalctl --unit=patches.service -n 50 --no-pager ;
else
  echo "Patches successfully started!";
fi

su - postgres -c "psql ${postgres_uri}" << EOF
  INSERT INTO roles (title) VALUES ('admin');
  INSERT into roles (title) VALUES ('user');
EOF

su - postgres -c "psql ${postgres_uri}" <<EOF
  INSERT INTO roles (title) VALUES ('admin');
  INSERT INTO roles (title) VALUES ('user');
  INSERT INTO users (name) VALUES ('Harrover Robert X99T54AA');
  INSERT INTO user_roles (username, role_id, updating_user) VALUES ('Harrover Robert X99T54AA', 1, 'System');
EOF

fi