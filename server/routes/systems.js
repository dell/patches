const getSystems = (params) => {
  let { id, brand } = params || {};

  let systemQuery = knex("systems");

  if (id) systemQuery.where("systems.system_id", id);
  if (brand) systemQuery.where("systems.brand", brand);

  return systemQuery.select("*");
};

module.exports = (app) => {
  app.get("/api/systems", (req, res) => {
    getSystems(req.query)
      .then((systems) => {
        res.send({ systems });
      })
      .catch((err) => {
        res.send({ error: err });
      });
  });

  app.get("/api/brands", (req, res) => {
    knex("systems")
      .distinct("brand")
      .then((brands) => {
        let brandsList = [];
        brands.forEach((item) => {
          if (item.brand) brandsList.push(item.brand);
        });
        res.send({
          brands: brandsList.sort(),
        });
      })
      .catch((err) => {
        res.send({ error: err });
      });
  });
};
