const getUserRoles = require("./roles").getUserRoles;

module.exports = (app) => {
  app.get("/api/auth", (req, res) => {
    console.log("auth user", req.user);
    let { subject, organizational_unit, organization, country } = req.user;
    authUser(req.user)
      .then((user) => {
        if (user.length == 1) {
          getUserRoles({ user: user[0] }).then((roles) => {
            user[0].roles = roles[0];
            return res.send({ user: user[0] });
          });
        } else if (user.length > 1) {
          //phone it in here i guess for now, there shouldn't actually be any duplicates
          return res.send({ error: "Duplicate user" });
        } else {
          knex("users")
            .insert({
              name: subject,
              organizational_unit: organizational_unit,
              organization: organization,
              country: country,
            })
            .returning("*")
            .then((iUser) => {
              getUserRoles({ user: iUser[0] }).then((roles) => {
                if (roles.length == 0) {
                  knex("user_roles")
                    .insert({
                      username: iUser[0].name,
                      role_id: 2,
                      updating_user: "System",
                    })
                    .then(() => {
                      getUserRoles({ user: iUser[0] }).then((roles) => {
                        iUser[0].roles = roles[0];
                        return res.send({ user: iUser });
                      });
                    });
                }
              });
            })
            .catch((err) => {
              res.status(500).send({ error: err });
            });
        }
      })
      .catch((err) => {
        res.status(500).send({ error: err });
      });
  });
};

const authUser = (params) => {
  let { subject, organizational_unit, organization } = params;

  let user = knex("users").select("*").where("name", subject);

  return user;
};
