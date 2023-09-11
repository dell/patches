if (process.env.NODE_ENV !== "production") require("dotenv").config();
const fs = require("fs");
const xml2js = require("xml2js");
const path = require("path");
const logger = require('./logger');
const parser = new xml2js.Parser();
const parsed_path = process.env.PARSED_PATH;
const opts = require('./config');
const { rebuildDatabase } = require('./rebuild_database');

let temp = {};
let temp_wrap = [];

const isEmpty = (obj) => {
  for (var i in obj) return false;
  return true;
};

const flatObject = function (source, target) {
  Object.keys(source).forEach((key) => {
    if (
      source[key] !== null &&
      source[key] instanceof Object &&
      (source[key].hasOwnProperty("$") || key === "$")
    ) {
      flatObject(source[key], target);
      target[key] = temp;
      return;
    }
    if (source[key] !== null && Array.isArray(source[key])) {
      source[key].forEach((k) => {
        flatObject(k, target);
      });
      target[key] = temp;
    }
    temp[key] = source[key];
  });
  if (!isEmpty(temp)) temp_wrap.push(temp);
  temp = {};
};

const parseSystems = (catalog) => {
  logger.debug(`Parsing systems...`);
  let systems = {};
  catalog.Manifest.SoftwareComponent.forEach((comp) => {
    comp.SupportedSystems[0].Brand.forEach((b) => {
      let brandName = b.Display[0]._;
      b.Model.forEach((model) => {
        model.$.brand = brandName;
        model.$.Display = model.Display[0]._;
        systems[model.$.systemID] = model;
        delete systems[model.$.systemID].Display;
      });
    });
  });
  let output = {};
  flatObject(systems, output);
  let flattened = temp_wrap;
  temp_wrap = [];
  return flattened;
};

const parseDevices = (catalog) => {
  logger.debug(`Parsing devices...`);
  let devices = {};
  let components = catalog.Manifest.SoftwareComponent;
  components.forEach((comp) => {
    comp.SupportedDevices[0].Device.forEach((d) => {
      d.Display = d["Display"][0]._;
      if (d.PCIInfo) {
        d.PCIInfo = d.PCIInfo[0].$;
      }
      devices[d["$"].componentID] = d;
    });
  });
  let output = {};
  flatObject(devices, output);
  let flattened = temp_wrap;
  temp_wrap = [];
  return flattened;
};

const parseComponents = (catalog, folderName, xml_file) => {
  logger.debug(`Parsing components for ${xml_file}`);
  if (!catalog.Manifest) return res.send({ error: "Catalog not parsed yet" });
  let components = catalog.Manifest.SoftwareComponent;
  components.forEach((comp) => {
    comp.Name = comp.Name[0].Display[0]._;
    comp.containerPowerCycleRequired = comp.$.containerPowerCycleRequired;
    comp.dateTime = comp.$.dateTime;
    comp.dellVersion = comp.$.dellVersion;
    comp.hashMD5 = comp.$.hashMD5;
    comp.packageID = comp.$.packageID;
    comp.packageType = comp.$.packageType;

    /* Add repo path for xml file as download path prefix */
    comp.path = folderName + "/" + comp.$.path;
    comp.xml_file_name = xml_file;

    comp.rebootRequired = comp.$.rebootRequired;
    comp.releaseDate = comp.$.releaseDate;
    comp.releaseID = comp.$.releaseID;
    comp.schemaVersion = comp.$.schemaVersion;
    comp.size = comp.$.size;
    comp.vendorVersion = comp.$.vendorVersion;
    delete comp.$;
    comp.ComponentType = comp.ComponentType[0].$.value;
    comp.Description = comp.Description[0].Display[0]._;
    comp.LUCategory = comp.LUCategory[0].$.value;
    comp.Category = comp.Category[0].$.value;
    if (comp.hasOwnProperty("RevisionHistory")) {
      comp.RevisionHistory = comp.RevisionHistory[0].Display[0]._;
    }
    comp.ImportantInfo = comp.ImportantInfo[0].$.URL;
    delete comp.Criticality;
    delete comp.ActivationRules;
    delete comp.SupportedDevices;
    let systems = [];
    comp.SupportedSystems[0].Brand.forEach((dev) => {
      dev.Model.forEach((info) => {
        systems.push({
          systemID: info.$.systemID,
          systemIDType: info.$.systemIDType,
          brand: info.$.brand,
        });
      });
    });
    comp.SupportedSystems = systems;
    if (comp.hasOwnProperty("SupportedOperatingSystems")) {
      delete comp.SupportedOperatingSystems;
    }

    // Handle Firmware Management Protocol (FMP) Wrappers
    if (comp.hasOwnProperty("FMPWrappers")) {
      const fmpWrappersData = comp.FMPWrappers[0].FMPWrapperInformation[0];
      // Convert the FMPWrappers data to a JSON string
      const fmpWrappersString = JSON.stringify(fmpWrappersData);
      // Assign the JSON string to the "f_mp_wrappers" field
      comp.f_mp_wrappers = fmpWrappersString;
      // Remove the original "FMPWrappers" property since we don't need it anymore
      delete comp.FMPWrappers;
    }
  });
  return components;
};


const parseBundles = (catalog) => {
  let bundles = catalog.Manifest.SoftwareBundle;
  bundles.forEach((bundle) => {
    bundle.Name = bundle.Name[0].Display[0]._;
    bundle.ComponentType[0].Display = bundle.ComponentType[0].Display[0]._;
    bundle.Description = bundle.Description[0].Display[0]._;
    bundle.Category[0].Display = bundle.Category[0].Display[0]._;
    if (bundle.hasOwnProperty("TargetOSes")) {
      bundle.TargetOSes[0].OperatingSystem[0].Display =
        bundle.TargetOSes[0].OperatingSystem[0].Display[0]._;
    }
    bundle.TargetSystems[0].Brand[0].Display =
      bundle.TargetSystems[0].Brand[0].Display[0]._;
    bundle.TargetSystems[0].Brand[0].Model[0].Display =
      bundle.TargetSystems[0].Brand[0].Model[0].Display[0]._;
    bundle.ImportantInfo[0].Display = bundle.ImportantInfo[0].Display[0]._;
    let packages = [];
    bundle.Contents[0].Package.forEach((package) => {
      let p = {};
      p.path = package.$.path;
      packages.push(p);
    });
    bundle.Contents[0].Package = packages;
  });
  return bundles;
};

/**
 * This function is responsible for creating all of the JSON files in xml/parsed
 * (default location). It calls all of the individual parsing functions for
 * systems, devices, components, and bundles. It then writes out the data to
 * the respective JSON files.
 * @param {fs.Dirent} xmlFile An fs.Dirent object pointing to the repository file.
 * Ex: R440_1.00_Catalog.xml
 * @param {string} repo_path Path to the repo for processing. Ex: /opt/patches/r440
 * @param {string} folderName The name of the repo folder. Ex: r440
 */
function parseCatalog(xmlFile, repo_path, folderName) {
  logger.debug(`Parsing catalog for ${xmlFile} with folder ${folderName}`)
  let catalog = {};
  logger.info(`Parsing catalog ${xmlFile}`);
  let xmlFileIdent = path.parse(xmlFile).name;

  fs.readFile(path.join(repo_path, xmlFile), "utf-16le", (err, data) => {

    if (err) {
      logger.error(`Patches encountered an error while processing the 
      repository XML file for the repository 
      ${path.join(repo_path, xmlFile)}. The error was ${err}.`);
    }

    parser.parseString(data, (err, result) => {
      catalog = result;
    });

    let parsed = {
      systems: parseSystems(catalog),
      devices: parseDevices(catalog),
      components: parseComponents(catalog, folderName, xmlFile),
      bundles: parseBundles(catalog),
    };

    logger.debug(`Writing out JSONs for ${xmlFile}`);
    Object.keys(parsed).forEach((item) => {
      fs.writeFileSync(
        path.join(parsed_path, `${xmlFileIdent}_${item}.json`),
        JSON.stringify(parsed[item], space=2),
        "utf8",
        () => {
          logger.info(`${item} finished`);
        }
      );
    });
  });
}; 

/**
 * Traverses the repository path and returns an array of repository folders.
 * A repository folder is identified by containing at least one XML file.
 * 
 * @returns {Array} An array of repository folders.
 */
function traverseXML() {
  const isRepoFolder = (file) => {
    // Check if the file is a directory.
    if (file.isDirectory()) {
      // Construct the full path to the potential repository folder.
      let repoPath = path.join(repo_path, file.name);
      
      // Filter the contents of the directory to find XML files.
      let repoContents = fs.readdirSync(repoPath, { withFileTypes: true });
      let containsXML = repoContents.some((entry) => path.extname(entry.name) === ".xml");

      // Return true if at least one XML file was found in the directory, indicating it's a repository folder.
      return containsXML;
    } else {
      // If the file is not a directory, return false.
      return false;
    }
  };

  let repoFolders = fs
    .readdirSync(repo_path, { withFileTypes: true })
    .filter((file) => isRepoFolder(file));
  
  return repoFolders;
};

/**
 * deleteParsedJson - This is called when a scan reveals that a repository has 
 * been removed. In that case, we need to remove the parsed JSON files. This
 * will clean up the parsed JSON files on disk.
 * @param {string} currentXMLFile The name of the repo's XML file. Ex: R7525
 */
function deleteParsedJson(currentXMLFile) {
  // TODO - This has not seen much testing - https://github.com/orgs/dell/projects/7/views/1?pane=issue&itemId=36552444
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
    logger.error(`There was an error while trying to delete the ` +
    `parsed JSON files for repo with XML file called ${currentXMLFile}. The ` +
    `error was ${error}`);
  }
}

/**
 * checkXmlFiles - Checks the filesystem for repositories. It triggers updates if 
 * there are new repositories or if some repositories have been removed.
 */
function checkXmlFiles() {
  // Log the process of checking for new XML files
  logger.debug("Checking for new XML files...");

  // Array to store the XML files found during traversal
  const traversedDirsXMLs = [];

  // Stack for iterative traversal of directories starting with the root path
  const stack = [opts.watchPath];

  // Iterate through the directories in the stack
  while (stack.length > 0) {
    // Pop the current directory from the stack
    const currentDir = stack.pop();

    // Iterate through the directory entries
    for (const dirEnt of fs.readdirSync(currentDir, { withFileTypes: true })) {
      // Construct the full path of the entry
      const fullPath = path.join(currentDir, dirEnt.name);

      // If the entry is a directory, add it to the stack for traversal
      if (dirEnt.isDirectory()) {
        stack.push(fullPath);
      } 
      // If the entry is an XML file and not already added, add it to the XML files list
      else if (
        path.extname(dirEnt.name) === ".xml" &&
        !traversedDirsXMLs.includes(fullPath.slice(opts.watchPath.length))
      ) {
        traversedDirsXMLs.push(fullPath.slice(opts.watchPath.length));
      }
    }
  }

  // Grab all existing XML files from the database
  knex("xml_files")
    .select() 
    .then((xmlFiles) => {
      // Process XML files already registered in the database
      for(let j = 0; j < xmlFiles.length; j++) {
        // Ensure split is properly initialized before using it
        let split = opts.watchPath.split('/');
        logger.info(`${opts.watchPath + '/' + split[split.length - 1]} already exists in the database.`);
        split = xmlFiles[j].file_path.split("/");
        watchSetup(split[split.length - 1]);
      }

      // Compare discovered XML files with the registered ones in the database
      for (let i = 0; i < traversedDirsXMLs.length; i++) {
        const filterXMLFile = xmlFiles.filter((xmlFile) => xmlFile.file_path.includes(traversedDirsXMLs[i]));

        // If the XML file is not registered, process it
        if (filterXMLFile.length === 0) {
          logger.info(`Found new XML file ${opts.watchPath + '/' +traversedDirsXMLs[i]}.`);
          watchSetup(traversedDirsXMLs[i]);
        }
      }
    });
}

/**
 * watchSetup - Monitors the specified repository path for changes to XML files
 * and parsed data. Sets up file watchers for repository changes and parsed data
 * changes, and triggers appropriate actions when changes are detected. If the
 * repo path doesn't exist, it's assumed to be deleted and triggers a cleanup to
 * remove its information from the database and its parsed JSON files.
 * @param {string} xmlFileAbsolutePath The XML filepath
 */
function watchSetup(xmlFileAbsolutePath) {

  const repoPath = path.join(opts.watchPath, path.dirname(xmlFileAbsolutePath));
  const xmlFileName = path.basename(xmlFileAbsolutePath);
  const xmlFileNoExtension = path.parse(xmlFileName).name
  const repoFolderName = path.basename(path.dirname(xmlFileAbsolutePath));

  // Check if the repository path exists
  fs.stat(repoPath, (err, stats) => {

    if (err) {
      // Log the deletion of the folder and initiate removal from the database
      logger.info(`Detected a repository change. It appears that the folder ${repoPath} no longer exists. We will remove its data from the database.`);
    }

    // Check if the repo exists and is a directory
    if (fs.existsSync(repoPath) && stats.isDirectory()) {
      logger.debug(`Repository ${repoPath} exists on the filesystem.`);

      // Initialize a queue to store repositories that need monitoring
      const queue = [{ repoPath, xmlFileName }];

      // Process each repository in the queue
      while (queue.length > 0) {
        const { repoPath, xmlFileName } = queue.shift();

        // Create a watch for parsed data changes. This accounts for someone
        // going in and renaming a JSON file on the fly
        logger.debug(`Creating the watch for ${xmlFileAbsolutePath}`);
        const parsedWatch = fs.watch(opts.parsedPath, (eventType, filename) => {
          if (
            filename.endsWith(".json") &&
            filename.includes(xmlFileNoExtension) &&
            filename.includes("components")
          ) {
            logger.info(`Detected a change to ${opts.parsedPath}/${xmlFileNoExtension}.json`);
            // Check if parsed data changes require database rebuild
            knex("components")
              .where("xml_file_name", "ILIKE", `%${xmlFileName}%`)
              .select()
              .then((xmlFileEntries) => {
                if (xmlFileEntries.length === 0) {
                  // Rebuild the database with the updated info
                  rebuildDatabase(xmlFileNoExtension).then(() => {
                    redirectFlag = false;
                  });
                }
                redirectFlag = false;
                parsedWatch.close();
              });
          }
        });

        // Create a watch for repository changes. This accounts for the folder
        // structure changing
        fs.watch(repoPath, (eventType, file) => {
          if (eventType === "rename" && path.extname(file) === ".xml") {
            // Add the repository to the queue for monitoring
            queue.push({ repoPath, xmlFileName }); // TODO - this is definitely wrong
          }
        });

        // Insert XML file info into the database
        logger.debug(`Inserting XML file ${xmlFileName} with repoPath ${repoPath} into the database...`)
        knex.transaction((trx) => {
          knex("xml_files")
            .transacting(trx)
            .insert({
              file_name: xmlFileName,
              file_path: repoPath,
            })
            .onConflict("file_path")
            .ignore()
            .then(trx.commit)
            .then(() => {
              redirectFlag = true; // TODO - the redirectFlag isn't doing anything right now https://github.com/orgs/dell/projects/7/views/1?pane=issue&itemId=36552541
              parseCatalog(xmlFileName, repoPath, repoFolderName);
            })
            .catch(trx.rollback);
        });
      }
    } else if (!fs.existsSync(repoPath)) {
      // If the repo doesn't exist, remove it from the database
      knex("xml_files")
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
                  // Clean the database if no XML files are found
                  cleanDatabase().then(() => {
                    redirectFlag = false;
                  });
                }
              });
          }
        });
    }
  });
}

module.exports = {
  parseCatalog,
  traverseXML,
  deleteParsedJson,
  checkXmlFiles,
  watchSetup,
};