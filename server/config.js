const fs = require('fs');
const logger = require('./logger');
const selfsigned = require('selfsigned');
const path = require("path");

/**
 * readCAs - Reads all CA certs from disk and load them
 * @param {string} dirPath The path to the directory containing the CA certs.
 * It can also be a direct path to a specific root CA file.
 * @return {string} The concatinated data of all CAs
 */
const readCAs = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`${dirPath} does not exist`);
  }
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) {
    throw new Error(`${dirPath} is not a directory. ${dirPath} must be a directory containing the root CA certs.`);
  }
  let directoryContents = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((file) => path.extname(file.name) === ".pem");
  if (directoryContents.length === 0) {
    throw new Error(`${dirPath} does not contain any root CA certs (.pem files)`);
  }
  let caPathContents = [];
  directoryContents.forEach((dirEnt) => {
    caPathContents.push(
      fs.readFileSync(path.resolve(dirPath, dirEnt.name))
    );
  });
  return caPathContents;
};


/*
  These options are populated by the environment variables passed into the
  program and then used throughout.

  SERVER_KEY: The private key of the patches server
  SERVER_CERT: The public key of the patches server
  SERVER_CA: The root CA cert
  PARSED_PATH: The path to the parsed files. These will be JSON output derived
  from the XML files located in REPO_PATH
  REPO_PATH: The path to the Dell Repository Manager (DRM) managed repos
*/

if ((process.env.SERVER_CERT && !process.env.SERVER_KEY) || (!process.env.SERVER_CERT && process.env.SERVER_KEY)) {
  throw new Error("SERVER_CERT and SERVER_KEY environment variables must be either both defined or both undefined.");
}

if (!process.env.SERVER_CERT || !process.env.SERVER_KEY) {
  logger.warn("SERVER_CERT or SERVER_KEY environment variable is missing. Generating self-signed certificate and key...");

  const keyPath = path.join(__dirname, 'private-key.key');
  const certPath = path.join(__dirname, 'certificate.crt');

  // Set environment variables with file paths
  logger.info("Updating environment variables.")
  process.env.SERVER_CERT = certPath;
  process.env.SERVER_KEY = keyPath;
  logger.info(process.env.SERVER_CERT);

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    const attrs = [{ name: 'commonName', value: 'patches.lan' }];
    const pems = selfsigned.generate(attrs, { days: 365 });

    fs.writeFileSync(keyPath, pems.private);
    logger.info('Private key generated.');

    fs.writeFileSync(certPath, pems.cert);
    logger.info('Certificate generated.');

  } else {
    logger.info('Key and certificate already exist.');
  }
} else {
  logger.info("Using provided SERVER_CERT and SERVER_KEY environment variables.");
}

if (!process.env.PARSED_PATH) {
  throw new Error("Missing environment variable: PARSED_PATH");
}

if (!process.env.REPO_PATH) {
  throw new Error("Missing environment variable: REPO_PATH");
}

if (!process.env.SERVER_CA) {
  throw new Error("Missing environment variable: SERVER_CA");
}

module.exports = {
  key: fs.readFileSync(process.env.SERVER_KEY),
  cert: fs.readFileSync(process.env.SERVER_CERT),
  requestCert: true,
  rejectUnauthorized: false,
  ca: readCAs(process.env.SERVER_CA),
  parsedPath: process.env.PARSED_PATH,
  watchPath: process.env.REPO_PATH,
};
