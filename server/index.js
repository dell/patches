if (process.env.NODE_ENV !== "production") require("dotenv").config();
const express = require("express");
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
const fs = require("fs");

var redirectFlag = false;

const readCAs = (dirPath) => {
  fs.stat(dirPath, (err, stats) => {
    if (fs.existsSync(dirPath) && stats.isDirectory()) {
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
    } else {
      return fs.readFileSync(dirPath);
    }
  });
};

const opts = {
  key: fs.readFileSync(process.env.SERVER_KEY),
  cert: fs.readFileSync(process.env.SERVER_CERT),
  requestCert: true,
  rejectUnauthorized: false,
  ca: readCAs(process.env.SERVER_CA),
  parsedPath: process.env.PARSED_PATH,
  watchPath: process.env.REPO_PATH,
};

const https = require("https");

knex = require("./db");
app.use(bodyParser.json());

const clientAuthMiddleware = () => (req, res, next) => {
  const cert = req.connection.getPeerCertificate();
  if (cert.subject) {
    req.user = {
      subject: cert.subject.CN,
      issuer: cert.issuer.CN,
      organizational_unit: cert.subject.OU,
      organization: cert.subject.O,
      country: cert.subject.C,
    };
    return next();
  } else {
    return res
      .status(401)
      .send(`Sorry, but you need to provide a client certificate to continue.`);
  }
};

const redirectAllClients = () => (req, res, next) => {
  if (redirectFlag) {
    return res
      .status(503)
      .send(`Server update in process, please try again in a few minutes`);
  }
  return next();
};

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
  } catch (err) {
    console.log(err);
  }
}

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
        console.error(err);
        resolve(false);
      });
      df.stderr.on("data", (err) => {
        console.error(err);
        resolve(false);
      });
    } else {
      resolve(false);
    }
  });
}

function pollNFS() {
  const traversedDirsXMLs = repoPoll(opts.watchPath);
  knex("xml_files")
    .select()
    .then((xmlFiles) => {
      if(xmlFiles.length > traversedDirsXMLs.length){
        for(let j = 0; j < xmlFiles.length; j++){
          let split = xmlFiles[j].file_path.split("/");
          watchSetup(split[split.length - 1]);
        }
      }
      for (let i = 0; i < traversedDirsXMLs.length; i++) {
        let filterXMLFile = xmlFiles.filter((xmlFile) => xmlFile.file_path.includes(traversedDirsXMLs[i]));
        if (filterXMLFile.length === 0) {
          watchSetup(traversedDirsXMLs[i]);
        }
      }
    });
}

function repoWatch() {
  const repoWatch = fs.watch(opts.watchPath, (eventType, folderName) => {
    if (eventType === "rename") {
      watchSetup(folderName);
    }
  });
}

function repoPoll(dir, files) {
  files = files || [];
  for (const dirEnt of fs.readdirSync(dir, { withFileTypes: true })) {
    if (dirEnt.isDirectory()) {
      repoPoll(path.resolve(dir, dirEnt.name), files);
    } else {
      let newDirEntry = dir.slice(opts.watchPath.length, dir.length);
      if (
        path.extname(dirEnt.name) === ".xml" &&
        !files.includes(newDirEntry)
      ) {
        files.push(newDirEntry);
      }
    }
  }
  return files;
}

function xmlWatch(repoPath, folderName) {
  const xmlWatch = fs.watch(repoPath, (eventType, file) => {
    if (eventType === "rename" && path.extname(file) === ".xml") {
      xmlParseSetup(repoPath, folderName);
    }
  });
}

function xmlParseSetup(repoPath, folderName) {
  /* Emulate array.first behavior to guarantee access instead of numeric indice (e) => true */
  let xmlFile = fs
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
/*        .onConflict("file_name")
        .ignore()*/
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

function watchSetup(folderName) {
  let repoPath = path.join(opts.watchPath, folderName);
  fs.stat(repoPath, (err, stats) => {
    if (fs.existsSync(repoPath) && stats.isDirectory()) {
      xmlParseSetup(repoPath, folderName);
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

function parseWatcher(currentXMLFile) {
  currentXMLFile = currentXMLFile.split("_").find((e) => true);

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
              rebuildDatabase(currentXMLFile).then(() => {
                redirectFlag = false;
              })
            }
            redirectFlag = false;
            parsedWatch.close();
          });
      /*knex("xml_files")
        .select()
        .then((xmlFiles) => {
          /!* Returns prefix of manifests from db results in order to add new filenames cleanly for parsing *!/
          /!* Probably refactor this garbage later *!/
          xmlFiles = xmlFiles.flatMap((xmlFile) =>
            xmlFile.file_name.split("_").find((e) => true)
          );

          for (let i = 0; i < xmlFiles.length; i++) {

            if(!xmlFiles.includes(currentXMLFile)){
              rebuildDatabase(xmlFiles[i]);
            }
          }
          redirectFlag = false;
          parsedWatch.close();
        });*/
    }
  });
}

app.use(clientAuthMiddleware());
app.use(redirectAllClients());

require("./routes")(app);

app.get("/api/auth", (req, res) => {});

app.use(express.static(path.resolve(__dirname, "..", "build")));
app.get("*", (req, res, next) => {
  res.sendFile(path.resolve(__dirname, "..", "build", "index.html"));
});

const PORT = process.env.PORT || 9000;

https.createServer(opts, app).listen(PORT, () => {
  console.log(`App listening on port ${PORT}!`);
  try {
    let repoPaths = [];
    if (fs.existsSync(opts.watchPath)) {
      var parseCount = 0;
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
                    console.log("!!! MIGRATION SUCCESSFUL !!!");
                  }).catch((err) => {
                    console.log(err);
                    console.log("!!! MIGRATION ERROR ROLLBACK !!!");
                    knex.migrate.rollback();
                  });
                } else {
                  console.log("No new migrations, continuing.....")
                }
              });
            }).catch((err) => {
              console.log(err);
            });
            if (nfs) {
              setInterval(pollNFS, 30000);
            } else {
              repoWatch();
            }
          }
        });
      });
    } else {
      throw new Error(
        "REPO  directory does not" +
          " exist, please check service config for REPO_PATH"
      );
    }
  } catch (err) {
    console.log(err);
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
