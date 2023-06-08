if (process.env.NODE_ENV !== "production") require("dotenv").config();
const config = require("../knexfile.js");
const knex = require("knex")(config[process.env.NODE_ENV]);

module.exports = knex;
