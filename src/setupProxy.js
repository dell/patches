const { createProxyMiddleware } = require("http-proxy-middleware");
const fs = require("fs");

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: {
        host: "localhost",
        port: 9000,
        protocol: "https:",
      },
      secure: false,
      changeOrigin: true,
    })
  );
};
