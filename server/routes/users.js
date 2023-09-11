const fastcsv = require("fast-csv");
const logger = require('../logger');

const getUsers = () => {
  let userQuery = knex("users")
    .join("user_roles", "users.name", "user_roles.username")
    .join("roles", "roles.id", "user_roles.role_id")
    .select(
      "users.name",
      "users.organizational_unit",
      "users.organization",
      "users.country",
      "user_roles.role_id",
      "roles.title",
      "users.created_at",
      "user_roles.updated_at as user_role_last_updated_at",
      "user_roles.updating_user"
    );

  logger.debug(`Raw user query is: ${userQuery.toQuery()}`);

  return userQuery;
};

module.exports = (app) => {
  app.get("/api/users", (req, res) => {
    if (!req.user && !app.can(req.user, "ADMIN:DASHBOARD")) {
      return res.send({
        error: "You do not have the appropriate access to do this action.",
      });
    }

    let userQuery = getUsers();

    let { search } = req.query;
    if (search) {
      return userQuery
        .where("name", "ILIKE", `%${search.trim()}%`)
        .then((users) => {
          res.send({ users });
        })
        .catch((err) => {
          res.send({ error: err });
        });
    }
    return userQuery
      .then((users) => {
        res.send({ users });
      })
      .catch((err) => {
        res.send({ error: err });
      });
  });

  app.get("/api/users/audit", (req, res) => {
    // Get the user query
    let userQuery = getUsers();
  
    // Set response headers for CSV download
    res.set("content-type", "text/csv");
    res.attachment("patches_user_log.csv");
  
    // Create a writable stream to write CSV data
    const csvStream = fastcsv.format({ headers: true });
  
    // Pipe the CSV data to the response
    csvStream.pipe(res);
  
    // Manually execute the userQuery and stream the data
    userQuery
      .then((users) => {
        // Stream the data to the CSV stream
        users.forEach((user) => {
          csvStream.write(user);
        });
  
        // End the CSV stream
        csvStream.end();
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
        res.status(500).send({ error: "Internal server error" });
      });
  });  

  app.get("/api/organizational_units", (req, res) => {
    if (!req.user && !app.can(req.user, "ADMIN:DASHBOARD")) {
      return res.send({
        error: "You do not have the appropriate access to do this action.",
      });
    }
    let { search } = req.query;
    knex("users")
      .distinct("organizational_unit")
      .whereRaw(
        `LOWER(organizational_unit) LIKE '%${search.trim().toLowerCase()}%'`
      )
      .then((organizational_units) => {
        res.send({
          organizational_units: organizational_units.map(
            (o) => o.organizational_unit
          ),
        });
      })
      .catch((err) => {
        res.send({ error: err });
      });
  });
};
