const getUserRoles = require("./roles").getUserRoles;
const stream = require("stream");

let rowCount = 0;

const csvTransform = (fields) =>
  new stream.Transform({
    objectMode: true,
    transform: (row, encoding, callback) => {
      let dbRow = [];

      if (rowCount == 0) {
        for (let j = 0; j < fields.length; j++) {
          dbRow.push(fields[j]);
        }
        dbRow.push("\n");
      }

      for (let i = 0; i < fields.length; i++) {
        if (typeof row[fields[i]] === "string") {
          if (row[fields[i]].includes(",")) {
            let existingRow = String(row[fields[i]]);
            let newRow = "";
            let position = row[fields[i]].indexOf(",");
            let index = [];

            while (position !== -1) {
              index.push(position);
              position = existingRow.indexOf(",", position + 1);
            }
            for (let i = 0; i <= index.length; i++) {
              if (i > 0) {
                newRow =
                  newRow + existingRow.substring(index[i - 1] + 1, index[i]);
              } else {
                newRow = existingRow.substring(i, index[i]);
              }
            }
            dbRow.push(newRow);
          } else {
            dbRow.push(row[fields[i]]);
          }
        } else {
          dbRow.push(row[fields[i]]);
        }
      }

      let returnRow = `${dbRow.join(",")}\n`;
      let firstCarriageIndex = returnRow.indexOf("\n");

      let index = [];
      let position = returnRow.indexOf("\n");
      while (position !== -1) {
        index.push(position);
        position = returnRow.indexOf("\n", position + 1);
      }
      if (index.length > 1) {
        returnRow =
          returnRow.slice(0, firstCarriageIndex - 1) +
          "\n" +
          returnRow.slice(firstCarriageIndex + 2, returnRow.length);
      }

      rowCount++;
      callback(null, returnRow);
    },
  });

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
    let userQuery = getUsers();
    res.set("content-type", "text/csv");
    res.attachment("patches_user_log.csv");
    let queryStream = userQuery.stream();
    queryStream
      .pipe(
        csvTransform([
          "name",
          "organizational_unit",
          "organization",
          "country",
          "role_id",
          "title",
          "created_at",
          "user_role_last_updated_at",
          "updating_user",
        ])
      )
      .pipe(res);
    rowCount = 0;
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
