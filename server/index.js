if (process.env.NODE_ENV !== "production") require("dotenv").config();
const express = require("express");
const forge = require('node-forge');
const { execFile, spawn } = require("child_process");
const os = require("os");
const path = require("path");
const app = express();
const bodyParser = require("body-parser");
const { parseCatalog } = require("./util");
const {
  rebuildDatabase,
  traverseXML,
  cleanDatabase
} = require("./rebuild_database");
const https = require("https");
const fs = require("fs");
knex = require("./db");

if (!process.env.PORT) {
  throw new Error("Missing environment variable: PORT");
}

if (!process.env.PATCHES_USER) {
  throw new Error("Missing environment variable: PATCHES_USER");
}

if (!process.env.DATABASE_URL) {
  throw new Error("Missing environment variable: DATABASE_URL");
}

if (!process.env.SERVER_CERT) {
  throw new Error("Missing environment variable: SERVER_CERT");
}

if (!process.env.SERVER_KEY) {
  throw new Error("Missing environment variable: SERVER_KEY");
}

if (!process.env.SERVER_CA) {
  throw new Error("Missing environment variable: SERVER_CA");
}

if (!process.env.DOWNLOAD_PATH) {
  throw new Error("Missing environment variable: DOWNLOAD_PATH");
}

if (!process.env.XML_PATH) {
  throw new Error("Missing environment variable: XML_PATH");
}

if (!process.env.PARSED_PATH) {
  throw new Error("Missing environment variable: PARSED_PATH");
}

if (!process.env.REPO_PATH) {
  throw new Error("Missing environment variable: REPO_PATH");
}

if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "development") {
  throw new Error("Invalid NODE_ENV value (must be either production or development): " + process.env.NODE_ENV);
}

console.log("All required environment variables are defined.");


// Redirect flag tells the server whether it should redirect clients trying
// to connect. This is set to true when the server is updating itself or
// performing other tasks where it would be unavailable.
var redirectFlag = false;

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

const opts = {
  key: fs.readFileSync(process.env.SERVER_KEY),
  cert: fs.readFileSync(process.env.SERVER_CERT),
  requestCert: true,
  rejectUnauthorized: false,
  ca: readCAs(process.env.SERVER_CA),
  parsedPath: process.env.PARSED_PATH,
  watchPath: process.env.REPO_PATH,
};

if (!opts.ca) {
  throw new Error("There was a problem reading the CA certs. The variable SERVER_CA exists but readCAs returned nothing.");
}

// See https://stackoverflow.com/a/39872729/4427375
app.use(bodyParser.json());

// TODO - See https://github.com/orgs/dell/projects/7/views/1?pane=issue&itemId=31653546

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

/**
 * deleteParsedJson - This is called when a scan reveals that a repository has 
 * been removed. In that case, we need to remove the parsed JSON files. This
 * will clean up the parsed JSON files on disk.
 * @param {string} currentXMLFile The name of the repo's XML file. Ex: R7525
 */
function deleteParsedJson(currentXMLFile) {
  currentXMLFile = currentXMLFile.split("_").find((e) => true);
  try {
    let directoryContents = fs.readdirSync(opts.parsedPath);
    if (directoryContents.length > 0) {
      directoryContents.forEach((file) => {
        if (file.endsWith(".json") && file.includes(currentXMLFile)) {
          fs.rmSync(path.join(opts.parsedPath, file));
        }
      });
    }
  } catch (error) {
    console.error(`ERROR: There was an error while trying to delete the ` +
    `parsed JSON files for repo with XML file called ${currentXMLFile}. The ` +
    `error was ${error}`);
  }
}

/**
 * checkFileSystem Runs the command `df -P -T | tail -n +2 | awk "{print $2}"
 * and then grabs the output. If the output includes a filesystem mounted as
 * NFS, it assumes that the mount in question must be the repository presented
 * to patches. See https://github.com/grantcurell/patches/issues/13. The promise
 * returns true only if it finds the letters nfs in the output.
 * @returns {Promise} Promise returns true if NFS is found, otherwise, false
 */
function checkFilesystem() {
  return new Promise((resolve, reject) => {
    if (os.platform() == "linux") {
      let df = spawn("df", ["-P", "-T", opts.watchPath], { shell: true });
      let tail = spawn("tail", ["-n", "+2"], { shell: true });
      let awk = spawn("awk", ["{print $2}"]);
      df.stdout.pipe(tail.stdin);
      tail.stdout.pipe(awk.stdin);
      awk.stdout.on("data", (data) => {
        if (data.toString().includes("nfs")) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      awk.stderr.on("data", (err) => {
        console.error(`ERROR: Failure while trying to run awk. Error was ${err}`);
        resolve(false);
      });
      df.stderr.on("data", (err) => {
        console.error(`ERROR: Failure while trying to run df. Error was ${err}`);
        resolve(false);
      });
    } else {
      resolve(false);
    }
  });
}

/**
 * pollNFS - Checks the filesystem for repositories. It triggers updates if 
 * there are new repositories or if some repositories have been removed.
 */
function pollNFS() {

  // Get all repo XML files
  const traversedDirsXMLs = repoPoll(opts.watchPath);

  // Grab all existing XML files from the database
  knex("xml_files")
    .select() 
    .then((xmlFiles) => {

      // If there are more XML files registered in the database then were 
      // discovered when we scanned the repos this code runs. It will trigger
      // watchSetup which will detected the changes and delete the missing repos
      if(xmlFiles.length > traversedDirsXMLs.length){ 
        for(let j = 0; j < xmlFiles.length; j++){
          let split = xmlFiles[j].file_path.split("/");
          console.info(`INFO: Processing repository ${opts.repoPath + '/' + split[split.length - 1]}`)
          watchSetup(split[split.length - 1]);
        }
      }

      // Explore all discovered repositories and ensure that they exist in the
      // database.
      for (let i = 0; i < traversedDirsXMLs.length; i++) {
        let filterXMLFile = xmlFiles.filter((xmlFile) => xmlFile.file_path.includes(traversedDirsXMLs[i]));
        if (filterXMLFile.length === 0) {
          console.info(`INFO: Processing repository ${opts.repoPath + '/' +traversedDirsXMLs[i]}`)
          watchSetup(traversedDirsXMLs[i]);
        }
      }
    });
}

/**
 * repoWatch - Monitors the repositories folder for rename events. If a file is
 * renamed its handler will trigger.
 */
function repoWatch() {
  const repoWatch = fs.watch(opts.watchPath, (eventType, folderName) => {
    if (eventType === "rename") {
      watchSetup(folderName);
    }
  });
}

/**
 * repoPoll recursively explores all directories in xml/ (by default) looking
 * collecting the XML files associated with any contained repositories
 * @param {string} dir A string pointing to the folder containing the XML file
 * and output from the Dell Repomanager export. Usually /opt/patches/xml
 * @param {Array} files A list of XML files corresponding to repos
 * @returns {Array} The current list of repo XML files
 */
function repoPoll(dir, files) {
  files = files || [];

  // Loop over all of the files/folders in dir. fs.readdirSync is a nodejs method
  for (const dirEnt of fs.readdirSync(dir, { withFileTypes: true })) {
    if (dirEnt.isDirectory()) {
      // Use nodejs' path.resolve method to resolve the path to an absolute path
      // and then recurse
      repoPoll(path.resolve(dir, dirEnt.name), files);
    } else {
      // Find files (not directories in folders) and check to see if they are
      // XML files. If they are XML file then add them to files
      let newDirEntry = dir.slice(opts.watchPath.length, dir.length);
      if (
        path.extname(dirEnt.name) === ".xml" &&
        !files.includes(newDirEntry)
      ) {
        // When this code is reached, dirEnt will be set to the XML file
        // output from Dell repository manager.
        files.push(newDirEntry);
      }
    }
  }
  return files;
}

/**
 * TODO - https://github.com/orgs/dell/projects/7/views/1?pane=issue&itemId=29635341
 * @param {*} repoPath 
 * @param {*} folderName 
 */
function xmlWatch(repoPath, folderName) {
  const xmlWatch = fs.watch(repoPath, (eventType, file) => {
    if (eventType === "rename" && path.extname(file) === ".xml") {
      xmlParseSetup(repoPath, folderName);
    }
  });
}

/**
 * xmlParseSetup adds the database entries for each repository catalog that has
 * been successfully parsed. It also adds file watches for the XML file of each
 * repository via parseWatcher such that a change to any of these XML files
 * will trigger parseWatcher's callback. Finally, it also calls parseCatalog
 * which parses the catalog itself and generates the JSON files in xml/parsed
 * (default location).
 * @param {string} repoPath Path to the repository. Ex: /opt/patches/xml/r440
 * @param {string} folderName The name of the folder in the path. Ex: r440
 */
function xmlParseSetup(repoPath, folderName) {
  /* Emulate array.first behavior to guarantee access instead of numeric indice (e) => true */
  let xmlFile = fs // This will be set to the name of the catalog XML
    .readdirSync(repoPath, { withFileTypes: true })
    .filter((file) => path.extname(file.name) === ".xml")
    .find((e) => true);
  if (xmlFile) {
    parseWatcher(xmlFile.name);
    const returned = knex.transaction((trx) => {
      knex("xml_files")
        .transacting(trx)
        .insert({
          file_name: xmlFile.name,
          file_path: repoPath,
        })
        .onConflict("file_path")
        .ignore()
        .then(trx.commit)
        .then(() => {
          redirectFlag = true;
          /* Pass the XML dirent and repo path for parsing */
          parseCatalog(xmlFile, repoPath, folderName);
        })
        .catch(trx.rollback);
    });
  } else if (!nfs) {
    xmlWatch(repoPath, folderName);
  }
}

/**
 * watchSetup - Create a callback function via xmlParseSetup which will watch 
 * the xml/parsed (default name) directory for any changes. If the repo path 
 * doesn't exist, we assume it has been deleted and launch a clean up to remove
 * its information from the database and its parsed JSON files.
 * @param {string} folderName The name of the repo folder. For example
 * /opt/patches/xml/r440 might be the full repo path. The folder name will be
 * r440.
 */
function watchSetup(folderName) {
  let repoPath = path.join(opts.watchPath, folderName);

  fs.stat(repoPath, (err, stats) => {
    if (err) {
      console.info(`INFO: Detected a repository change. It appears that the ` +
      `folder ${repoPath} no longer exists. We will remove its data from the ` +
      `database.`);
    }

    // Check if the repo exists and is a directory
    if (fs.existsSync(repoPath) && stats.isDirectory()) {
      console.info(`INFO: Found repository ${repoPath}`)
      xmlParseSetup(repoPath, folderName);

    // If it doesn't exist remove it from our database.
    } else if (!fs.existsSync(repoPath)) {
      let allManifests = knex("xml_files")
        .where("file_path", repoPath)
        .select()
        .then((xmlFiles) => {
          if (xmlFiles[0]) {
            let xmlFile = xmlFiles[0];
            deleteParsedJson(xmlFile.file_name);
            return (deleted = knex.transaction((trx) => {
              knex("xml_files")
                .transacting(trx)
                .where("file_path", repoPath)
                .del()
                .then(trx.commit)
                .catch(trx.rollback);
            }));
          }
        })
        .then((deleted) => {
          if (deleted > 0) {
            knex("xml_files")
              .select()
              .then((xmlFiles) => {
                if (xmlFiles.length === 0) {
                  cleanDatabase().then(() => {
                    redirectFlag = false;
                  })
                }
              });
          }
        });
    }
  });
}

/**
 * parseWatcher - The purpose of this function is to use fs.watch to create a
 * callback function on the folder xml/parsed. If there are any changes in the
 * parsed folder, the callback function defined her will be called. The callback
 * function will specifically examine any JSON file including the name 
 * components. If one of the parsed files changes, it triggers a database 
 * rebuild
 * @param {*} currentXMLFile 
 */
function parseWatcher(currentXMLFile) {
  currentXMLFile = currentXMLFile.split("_").find((e) => true);

  // Create a callback function which is called anytime there is a change in the
  // xml/parsed directory
  const parsedWatch = fs.watch(opts.parsedPath, (eventType, filename) => {
    if (
      filename.endsWith(".json") &&
      filename.includes(currentXMLFile) &&
      filename.includes("components")
    ) {
      knex("components")
          .where("xml_file_name", "ILIKE", `%${currentXMLFile}%`)
          .select()
          .then((xmlFile) => {
            if (xmlFile.length == 0) {
              // Rebuild the database with the updated info
              rebuildDatabase(currentXMLFile).then(() => {
                redirectFlag = false;
              })
            }
            redirectFlag = false;
            parsedWatch.close();
          });
    }
  });
}

// See https://stackoverflow.com/a/11321828/4427375
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
  console.info(`INFO: App listening on port ${BACKEND_PORT}!`);
  try {
    let repoPaths = [];
    if (fs.existsSync(opts.watchPath)) {
      var parseCount = 0;

      /*
        What is being done here is they are spawning a series of Linux shell child processes
        amounting to `df -P -T <watch_path> | tail -n +2 | awk "{print $2}"` and then they
        are checking if that has the word NFS in it. If it does, checkFilesystem resolves to
        true and then they launch an polling agent against the NFS share.
      */
      checkFilesystem().then((nfs) => {
        return knex.migrate.currentVersion().then((result) => {
          if (result === "none") {
            
            knex.migrate.down(['20200330095735_init.js']).then(() => {
              knex.migrate.up(['20200330095735_init.js']).then(() => {
                let xmlFiles = traverseXML();
                for (let i = 0; i < xmlFiles.length; i++) {
                  watchSetup(xmlFiles[i].name);
                }
                if (nfs) {
                  setInterval(pollNFS(), 30000);
                } else {
                  repoWatch();
                }
              });
            })
          } else {
            knex.migrate.list().then((list) => {
              knex.migrate.currentVersion().then((curVer) => {
                if (list[1].length > 0){
                  knex.migrate.latest().then(() => {
                    console.info("INFO: !!! MIGRATION SUCCESSFUL !!!");
                  }).catch((err) => {
                    console.error(err);
                    console.error("ERROR: !!! MIGRATION ERROR ROLLBACK !!!");
                    knex.migrate.rollback();
                  });
                } else {
                  console.info("INFO: No new migrations, continuing.....")
                }
              });
            }).catch((err) => {
              console.error(err);
            });
            if (nfs) {
              setInterval(pollNFS, 30000);
            } else {
              repoWatch();
            }
          }
        });
      });
     pollNFS()
    } else {
      throw new Error(
        "REPO  directory does not" +
          " exist, please check service config for REPO_PATH"
      );
    }
  } catch (error) {
    console.error(`ERROR: Patches encountered a general failure. That it ` +
    `couldn't handle. The error was: ${error}`);
    /*
     Not necessary for existing application,
     leaving this in here for future work that
     requires application restart based on unhandled conditions
     */

    /*console.log(err)

    process.on('exit', () =>{
      require('child_process').spawn(process.argv.shift(), process.argv, {
        cwd: process.cwd(),
        detached : true,
        stdio: 'inherit'
      })
    })
    process.exit(1)*/
  }
});
