module.exports = (app) => {
  require("./rbac")(app);
  require("./auth")(app);
  require("./users")(app);
  require("./roles")(app);
  require("./systems")(app);
  require("./components")(app);
  require("./devices")(app);
  require("./uploads")(app);
  require("./downloads")(app);
  require("./xml")(app);
};
