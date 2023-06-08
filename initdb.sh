read -p "Enter the postgres server URI configuration (format: [user]:[password]@[host]:5432/patches): " postgres_uri
if [ -z "$postgres_uri" ]; then
  postgres_uri="root:password@localhost:5432/patches" ;
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