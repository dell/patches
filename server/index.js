if (process.env.NODE_ENV !== "production") require("dotenv").config();
const express = require("express");
const forge = require('node-forge');
const path = require("path");
const app = express();
const bodyParser = require("body-parser");
const { watchSetup, traverseXML, checkXmlFiles } = require("./util");
const https = require("https");
const fs = require("fs");
const logger = require('./logger');
const opts = require('./config');
knex = require("./db");

if (!process.env.PORT) {
  throw new Error("Missing environment variable: PORT");
}

if (!process.env.DATABASE_URL) {
  throw new Error("Missing environment variable: DATABASE_URL");
}

if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "development") {
  throw new Error("Invalid NODE_ENV value (must be either production or development): " + process.env.NODE_ENV);
}

if (!process.env.XML_PATH) {
  throw new Error("Missing environment variable: XML_PATH");
}

logger.info("All required environment variables are defined.");

// Redirect flag tells the server whether it should redirect clients trying
// to connect. This is set to true when the server is updating itself or
// performing other tasks where it would be unavailable.
var redirectFlag = false;

app.use(bodyParser.json());

/**
 * clientAuthMiddleware checks inbound requests and validates that the client
 * request is using a certificate signed by the CA Patches is using.
 * If the DISABLE_CLIENT_CERT_AUTH environment variable is true,
 * it sets default user values and proceeds to the next handler.
 * Otherwise, it validates the client certificate and populates req.user
 * with the certificate details.
 *
 * @returns {Function} Middleware function to handle client certificate authentication.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next function in the middleware chain.
 * @throws {Error} If the client certificate is invalid.
 */
const clientAuthMiddleware = () => (req, res, next) => {
  // Extract the client certificate from the X-SSL-CERT header
  const cert = req.headers['x-ssl-cert'];

  if (cert) {
    // Parse the PEM-encoded certificate
    const parsedCert = parseCertificate(cert);

    req.user = {
      subject: parsedCert.subject.getField('CN').value,
      issuer: parsedCert.issuer.getField('CN').value,
      organizational_unit: parsedCert.subject.getField('OU').value,
      organization: parsedCert.subject.getField('O').value,
      country: parsedCert.subject.getField('C').value,
    };

    return next();
  } else if (process.env.DISABLE_CLIENT_CERT_AUTH === 'true') {
    // Set req.user with default values
    req.user = {
      subject: 'Unknown User',
      issuer: 'unknown',
      organizational_unit: 'unknown',
      organization: 'unknown',
      country: 'unknown',
    };

    return next();
  } else {
    return res
      .status(401)
      .send({ error: 'Sorry, but you need to provide a client certificate to continue.' });
  }
};

/**
 * Parses a BASE64 encoded certificate and returns the parsed certificate object.
 *
 * @param {string} cert - The BASE64 encoded certificate.
 * @returns {Object|null} The parsed certificate object or null if parsing fails.
 */
function parseCertificate(cert) {
  const decodedCert = decodeURIComponent(cert);
  return forge.pki.certificateFromPem(decodedCert);
}

/**
 * redirectAllClients - This is triggered when the redirectFlag is set to true. 
 * If the redirectFlag is set to true it will stop all further processing and
 * inform the user with a 503 error.
 * @returns {*} Either triggers the next route handler or returns the 503 error
 */
const redirectAllClients = () => (req, res, next) => {
  if (redirectFlag) {
    return res
      .status(503)
      .send(`Server update in process, please try again in a few minutes`);
  }
  return next();
};

app.use(clientAuthMiddleware());
app.use(redirectAllClients());

require("./routes")(app);
app.get("/api/auth", (req, res) => {});

app.use(express.static(path.resolve(__dirname, "..", "build")));
app.get("*", (req, res, next) => {
  res.sendFile(path.resolve(__dirname, "..", "build", "index.html"));
});

const BACKEND_PORT = process.env.BACKEND_PORT || 9000;

https.createServer(opts, app).listen(BACKEND_PORT, () => {
  logger.info(`App listening on port ${BACKEND_PORT}!`);
  try {
    checkXmlFiles()

    // Make sure watchPath exists before continuing
    if (fs.existsSync(opts.watchPath)) {
      return knex.migrate.currentVersion().then((result) => {
        if (result === "none") {
          knex.migrate.down(['20200330095735_init.js']).then(() => {
            knex.migrate.up(['20200330095735_init.js']).then(() => {
              let xmlFiles = traverseXML();
              for (let i = 0; i < xmlFiles.length; i++) {
                watchSetup(xmlFiles[i].name);
              }

              // Monitors the repositories folder for rename events. If a file is
              // renamed its handler will trigger.
              fs.watch(opts.watchPath, (eventType, folderName) => {
                if (eventType === "rename") {
                  watchSetup(folderName);
                }
              });

            });
          })
        } else {
          knex.migrate.list().then((list) => {
            knex.migrate.currentVersion().then((curVer) => {
              if (list[1].length > 0){
                knex.migrate.latest().then(() => {
                  logger.info("!!! MIGRATION SUCCESSFUL !!!");
                }).catch((err) => {
                  console.error(err);
                  logger.error("!!! MIGRATION ERROR ROLLBACK !!!");
                  knex.migrate.rollback();
                });
              } else {
                logger.info("INFO: No new migrations, continuing.....")
              }
            });
          }).catch((err) => {
            console.error(err);
          });

          // Monitors the repositories folder for rename events. If a file is
          // renamed its handler will trigger.
          fs.watch(opts.watchPath, (eventType, folderName) => {
            if (eventType === "rename") {
              watchSetup(folderName);
            }
          });
        }
      });
    } else {
      throw new Error(
        "REPO directory does not exist, please check service config for REPO_PATH"
      );
    }
  } catch (error) {
    logger.error(`Patches encountered a general failure. That it ` +
    `couldn't handle. The error was: ${error}`);
  }
});
