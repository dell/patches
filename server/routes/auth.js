const getUserRoles = require("./roles").getUserRoles;

module.exports = (app) => {
  // Define a GET route for authentication
  app.get("/api/auth", (req, res) => {
    // Log the user object from the request (debugging purposes)
    console.info("auth user", req.user);

    // Extract subject, organizational_unit, organization, and country from the user object
    let { subject, organizational_unit, organization, country } = req.user;

    // Authenticate the user based on the user object
    authUser(req.user)
      .then((user) => {
        // If the user is found in the authentication process
        if (user.length == 1) {
          // Get the roles of the user
          getUserRoles({ user: user[0] }).then((roles) => {
            // Add the roles to the user object and send it as a response
            user[0].roles = roles[0];
            return res.send({ user: user[0] });
          });
        }
        // If there are duplicate users (which shouldn't happen)
        else if (user.length > 1) {
          // Send an error response for duplicate users
          // (This comment indicates that the author is not handling the duplicate user scenario properly)
          return res.send({ error: "Duplicate user" });
        }
        // If the user is not found, insert the user into the "users" table
        else {
          knex("users")
            .insert({
              name: subject,
              organizational_unit: organizational_unit,
              organization: organization,
              country: country,
            })
            .returning("*")
            .then((iUser) => {
              // Get the roles of the newly inserted user
              getUserRoles({ user: iUser[0] }).then((roles) => {
                // If the user has no roles, insert a default role (role_id = 2) for the user
                if (roles.length == 0) {
                  knex("user_roles")
                    .insert({
                      username: iUser[0].name,
                      role_id: 2,
                      updating_user: "System",
                    })
                    .then(() => {
                      // Get the roles of the user again and send the user object as a response
                      getUserRoles({ user: iUser[0] }).then((roles) => {
                        iUser[0].roles = roles[0];
                        return res.send({ user: iUser });
                      });
                    });
                }
              });
            })
            .catch((err) => {
              // If any errors occur during the process, send a 500 status code and the error message as a response
              res.status(500).send({ error: err });
            });
        }
      })
      .catch((err) => {
        // If any errors occur during the authentication process, send a 500 status code and the error message as a response
        res.status(500).send({ error: err });
      });
  });
};

const authUser = (params) => {
  let { subject, organizational_unit, organization } = params;

  let user = knex("users").select("*").where("name", subject);

  return user;
};
