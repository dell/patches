const permissions = {
  admin: ["ADMIN:DASHBOARD", "ADMIN:UPLOAD"],
};

module.exports = (app) => {
  app.can = (user, permission) => {
    if (!user.roles) return false;
    let canDo = false;
    user.roles.forEach((role) => {
      if (permissions[role.title].includes(permission)) canDo = true;
    });
    return canDo;
  };
};
