module.exports = (app) => {
  app.get("/api/devices", (req, res) => {
    let devices = [];
    res.send({ devices });
  });
};
