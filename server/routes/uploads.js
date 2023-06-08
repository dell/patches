const getUploads = (params) => {
  let { id, system } = params || {};

  let uploadQuery = knex("user_uploads");

  if (id) uploadQuery.where("user_uploads.id", id);
  if (system) uploadQuery.where("user_uploads.system_id", system);

  return uploadQuery.select("*");
};

module.exports = (app) => {
  app.get("/api/uploads", (req, res) => {
    let { download } = req.query;
    getUploads(req.query)
      .then((uploads) => {
        if (download !== "true") {
          res.send({ uploads });
        } else {
          res.send({ link: uploads[0].path });
        }
      })
      .catch((err) => {
        res.send({ error: err });
      });
  });

  app.post("/api/uploads/add", (req, res) => {
    if (!req.user && !app.can(req.user, "ADMIN:UPLOAD")) {
      return res.send({
        error: "You do not have the appropriate access to do this action.",
      });
    }
    let { system, name, path } = req.query;
    knex("user_uploads")
      .insert({
        system_id: system,
        user: req.user.subject,
        document_name: name,
        path: path,
      })
      .then(() => {
        getUploads({ system: system }).then((uploads) => {
          res.send({ uploads });
        });
      })
      .catch((err) => {
        res.status(400).send({ error: "Could not upload file" });
      });
  });
};
