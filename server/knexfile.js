const pg = require('pg');

if (!process.env.NODE_ENV || !['production', 'development'].includes(process.env.NODE_ENV)) {
  throw new Error('NODE_ENV must be set to either "production" or "development". ' +
    'Make sure the .env file is set up correctly. You should see ' +
    'NODE_ENV={development|production} in the .env file.');
}

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// require the url module to parse the database url
let url = require('url')
let db_url = url.parse(process.env.DATABASE_URL)

// get the host from the db_url
let host = db_url.host.substr(0, db_url.host.indexOf(':'))

// get the user and password from the db_url
let user = db_url.auth.substr(0, db_url.auth.indexOf(':'))
let pass = db_url.auth.substr(db_url.auth.indexOf(':') + 1, db_url.auth.length)

// get the database name from the db_url
let db = db_url.path.substr(1)

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host: host,
      user: user,
      password: pass,
      database: db,
      ssl: process.env.SSL_ON === '1' ? true : false
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  },
  production: {
    client: 'pg',
    connection: {
      host: host,
      user: user,
      password: pass,
      database: db,
      ssl: process.env.SSL_ON === '1' ? true : false
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  }
}

// path, system_id, document_name, user_id of who uploaded (name)
// /systems/upload
// upload doc, save to file system, save path to db
// underneath upload box on ui, pull list of all docs and show them
// doc_name, file upload path, box 