exports.up = async (knex) => {
  return await Promise.all([
    knex.raw(`
    CREATE OR REPLACE FUNCTION pseudo_encrypt(VALUE int) returns bigint AS $$
    DECLARE
    l1 int;
    l2 int;
    r1 int;
    r2 int;
    i int:=0;
    BEGIN
    l1:= (VALUE >> 16) & 65535;
    r1:= VALUE & 65535;
    WHILE i < 3 LOOP
      l2 := r1;
      r2 := l1 # ((((1366.0 * r1 + 150889) % 714025) / 714025.0) * 32767)::int;
      l1 := l2;
      r1 := r2;
      i := i + 1;
    END LOOP;
    RETURN ((l1::bigint << 16) + r1);
    END;
    $$ LANGUAGE plpgsql strict immutable;
    CREATE sequence random_int_seq;
    CREATE OR REPLACE function make_random_id() returns bigint as $$
      select pseudo_encrypt(nextval('random_int_seq')::int)
    $$ language sql;
  `),
    knex.schema.createTable('users', function (table) {
      table.string('name').notNullable().primary()
      table.string('organizational_unit')
      table.string('organization')
      table.string('country')
      table.timestamps(undefined, true)
    }),
    knex.schema.createTable('roles', function (table) {
      // Use integer type for the ID column.
      table.integer('id').primary();
    
      // Add the title column for the role name.
      table.string('title');
    
      // Add timestamps for "created_at" and "updated_at".
      table.timestamps(undefined, true);
    }),    
    knex("roles").insert([
      { id: 1, title: "admin" },
      { id: 2, title: "user" },      
    ]),
    // Create the "user_roles" table with the specified schema using knex.
    knex.schema.createTable('user_roles', function (table) {
      // Primary key for the "user_roles" table, automatically increments with each new record.
      table.increments();

      // The username field that stores the name of the user associated with this role.
      // It must not be nullable and references the "name" field in the "users" table.
      // When the referenced user is deleted, all associated user_roles records are deleted (CASCADE).
      table.string('username').notNullable().references('name').inTable('users').onDelete('CASCADE');

      // The role_id field that stores the ID of the role associated with this user.
      // It must not be nullable and references the "id" field in the "roles" table.
      // When the referenced role is deleted, all associated user_roles records are deleted (CASCADE).
      table.integer('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');

      // The updating_user field that stores the name of the user who is updating this user's role.
      // It must not be nullable and references the "name" field in the "users" table.
      // When the referenced user is deleted, all associated user_roles records are deleted (CASCADE).
      table.string('updating_user').notNullable().references('name').inTable('users').onDelete('CASCADE');

      // Automatically adds timestamps for "created_at" and "updated_at" columns.
      // The default value is the current timestamp when a record is inserted/updated.
      table.timestamps(undefined, true);
    }),
    knex.schema.createTable('systems', function (table) {
      table.string('system_id').notNullable().primary()
      table.string('system_id_type').notNullable()
      table.string('brand')
      table.string('name')
      table.timestamps(undefined, true)
    }),
    knex.schema.createTable('components', function (table) {
      table.bigInteger('id').defaultTo(knex.raw('make_random_id()')).primary();
      table.text('name');
      table.string('component_type');
      table.text('description');
      table.string('lu_category');
      table.string('category');
      table.text('revision_history');
      table.string('important_info');
      table.boolean('container_power_cycle_required');
      table.datetime('date_time');
      table.string('dell_version');
      table.string('hash_md5').unique().notNullable();
      table.string('package_id');
      table.string('package_type');
      table.string('path');
      table.string('xml_file_name')
        .notNullable()
        .references('file_name')
        .inTable('xml_files')
        .onDelete('CASCADE');
      table.boolean('reboot_required');
      table.date('release_date');
      table.string('release_id');
      table.string('schema_version');
      table.integer('size');
      table.string('vendor_version');
      table.jsonb('f_mp_wrappers').defaultTo(JSON.stringify({
        digitalSignature: null,
        driverFileName: null,
        filePathName: null,
        identifier: null,
        name: null,
        inventory: {
          source: null,
          supported: null
        },
        update: {
          rollback: null,
          supported: null
        }
      }));
    
      table.timestamps(undefined, true);
    }),
    knex.schema.createTable('component_systems', function (table) {
      table.bigInteger('id').defaultTo(knex.raw('make_random_id()')).primary()
      table
        .bigInteger('component_id')
        .notNullable()
        .references('id')
        .inTable('components')
        .onDelete('CASCADE')
      table
        .string('system_id')
        .notNullable()
        .references('system_id')
        .inTable('systems')
        .onDelete('CASCADE')
      table.timestamps(undefined, true)
    }),
    knex.schema.createTable('user_downloads', function (table) {
      table.increments()
      table
        .string('user')
        .notNullable()
        .references('name')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .bigInteger('component_id')
        .notNullable()
        .references('id')
        .inTable('components')
        .onDelete('CASCADE')
      table.timestamps(undefined, true)
    }),
    knex.schema.createTable('user_uploads', function (table) {
      table.increments()
      table
        .string('user')
        .notNullable()
        .references('name')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .string('system_id')
        .notNullable()
        .references('system_id')
        .inTable('systems')
        .onDelete('CASCADE')
      table.string('document_name').notNullable()
      table.string('path').notNullable()
      table.timestamps(undefined, true)
    }),
    knex.schema.createTable('xml_files', function(table) {
      table.increments()
      table.string('file_name').unique().notNullable()
      table.string('file_path').unique().notNullable()
      table.timestamps(undefined, true)
    }),
      knex.raw(`CREATE OR REPLACE FUNCTION trigger_set_timestamp()
          RETURNS TRIGGER AS $$
          BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;`),
      knex.raw(`CREATE TRIGGER set_timestamp
          BEFORE UPDATE on user_roles
          FOR EACH ROW
          EXECUTE PROCEDURE trigger_set_timestamp();`),
      knex.raw(`INSERT INTO public.users (name, organizational_unit, organization, country)
                VALUES ('System', null, null, null)`),
  ])
}

exports.down = function (knex) {
  return Promise.all([
    knex.raw('DROP sequence random_int_seq;'),
    knex.schema.dropTable('user_uploads'),
    knex.schema.dropTable('user_downloads'),
    knex.schema.dropTable('component_systems'),
    knex.schema.dropTable('components'),
    knex.schema.dropTable('systems'),
    knex.schema.dropTable('user_roles'),
    knex.schema.dropTable('roles'),
    knex.schema.dropTable('users'),
    knex.schema.dropTable('xml_files'),
  ])
}
