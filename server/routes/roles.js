const logger = require('../logger');

if (process.env.NODE_ENV !== "production") require("dotenv").config();

const authUser = (subject) => {
  let user = knex("users").select("*").where("name", subject);
  return user;
};

const getRoles = (params) => {
  let { search } = params || {};
  let rolesQuery = knex("roles");
  return rolesQuery.select("*");
};

module.exports = (app) => {
  app.get("/api/roles", (req, res) => {
    getRoles(req.query)
      .then((roles) => {
        res.send({ roles });
      })
      .catch((err) => {
        res.send({ error: err });
      });
  });

  app.get("/api/roles/:user", (req, res) => {
    let { user } = req.params;
    getUserRoles({ user: user })
      .then((roles) => {
        res.send({ roles });
      })
      .catch((err) => {
        res.send({ error: err });
      });
  });

  // Handle PUT request to update user roles
  app.put("/api/roles/:user", (req, res) => {
    // Extract user and target role from request parameters and query
    let { user } = req.params;
    let { target_role, target_organizational_unit } = req.query;

    /* auth user creds */
    // Extract subject and organizational_unit from the authenticated user's request
    let { subject, organizational_unit } = req.user;

    // Check for required parameters
    if (!user) return res.send({ error: "User required" });
    if (!target_role) return res.send({ error: "Role required" });

    // Check if the user is trying to modify their own role (downgrade themselves)
    if (user === subject)
      return res.send({ error: "Cannot downgrade yourself" });

    // Authenticate the user making the request and get their roles
    authUser(subject).then((request_auth_user) => {
      getUserRoles({ user: request_auth_user[0] }).then((roles) => {
        // Check if the requesting user has administrator access (role_id = 1)
        if (roles && roles[0].role_id == 1) {
          // Authenticate the user being modified and get their current roles
          authUser(user).then((modify_user) => {
            getUserRoles({ user: modify_user[0] }).then((roles) => {
              // Get the current role of the user being modified
              current_role = roles[0].role_id;

              // Check if the user is already assigned the target role
              knex("user_roles")
                .select("username")
                .where({ username: user, role_id: target_role })
                .first()
                .then((uRole) => {
                  if (uRole)
                    return res.send({ error: "User already has this role" });

                  // Update the user's role in the database
                  knex("user_roles")
                    .update({
                      role_id: target_role,
                      updating_user: subject,
                    })
                    .where({ username: user })
                    .then(() => {
                      // Get the updated roles of the modified user and send the response
                      getUserRoles({ user: modify_user[0] })
                        .then((roles) => {
                          res.send({ roles });
                        })
                        .catch((err) => {
                          logger.error("Unable to get roles for user" + err);
                          res.send({ error: err });
                        });
                    })
                    .catch((err) => {
                      logger.error(
                        "Unable to update user role in database" + err
                      );
                      res.send({ error: err });
                    });
                })
                .catch((err) => {
                  logger.error("Unable to find user in roles table" + err);
                  res.send({ error: err });
                });
            });
          });
        } else {
          // If the requesting user does not have administrator access, return an error
          return res.send({ error: "Administrator access required" });
        }
      });
    });
  });

  app.delete("/api/roles/:user", (req, res) => {
    let { user } = req.params;

    knex("user_roles")
      .del()
      .where("username", user)
      .then(() => {
        getUserRoles({ user })
          .then((roles) => {
            res.send({ roles });
          })
          .catch((err) => {
            res.send({ error: err });
          });
      })
      .catch((err) => {
        res.send({ error: err });
      });
  });
};

const hasRole = (module.exports.hasRole = (user, roles) => {
  return user.roles.find((r) => roles.includes(r.title));
});

const getUserRoles = (module.exports.getUserRoles = (params, trx) => {
  let { user } = params || {};
  let rolesQuery = trx ? trx("user_roles") : knex("user_roles");

  rolesQuery
    .join("roles", "roles.id", "user_roles.role_id")
    .join("users", "users.name", "user_roles.username")
    .where("user_roles.username", user.name)
    .where("users.organizational_unit", user.organizational_unit)
    .where("users.organization", user.organization)
    .where("users.country", user.country);

  return rolesQuery.select([
    "user_roles.username",
    "user_roles.role_id",
    "roles.title",
  ]);
});
