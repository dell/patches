if (process.env.NODE_ENV !== "production") require("dotenv").config();
const { debug } = require("console");
const fs = require("fs");
const path = require("path");
const parsed_path = process.env.PARSED_PATH;
const repo_path = process.env.REPO_PATH;

knex = require("./db");

/**
 * camelToSnake - Utility function for converting camel case to snake case
 * @param {string} inputString The string which you would like to convert to
 * snake case
 * @returns {string} The string as snake case
 */
function camelToSnake(inputString) {
  return inputString
    .replace(/[\w]([A-Z])/g, function (m) {
      return m[0] + "_" + m[1];
    })
    .toLowerCase();
}

/**
 * loadParsedManifest - This function is triggered when an update is detected
 * in the xml/parsed folder. It will read the updated JSON files from disk
 * and then parse the JSON into variables and return them
 * @param {string} currentXMLFile The name of the updated XML file. Ex: R7525
 * @returns {Array[Array, Array]} Arrays of the systems and component JSON
 * loaded from disk
 */
function loadParsedManifest(currentXMLFile) {
  let systems = "";
  let components = "";
  try {

    // Load the updated systems file from disk
    systems = fs.readFileSync(
      parsed_path + `/${currentXMLFile}_systems.json`,
      "utf8"
    );

    // Parse it to JSON
    systems = JSON.parse(systems);

    // Read the updated components file from disk
    components = fs.readFileSync(
      parsed_path + `/${currentXMLFile}_components.json`,
      "utf8"
    );

    // Parse it to JSON
    components = JSON.parse(components);

  } catch (error) {
    console.error(`ERROR: We encountered an error while trying to read either ` +
    `${parsed_path + `/${currentXMLFile}_systems.json`} or ` +
    `${parsed_path + `/${currentXMLFile}_components.json`} from disk. ` +
    `The error was: ${error}`);
  }

  // Return the parsed JSON objects
  return [systems, components];
}

/**
 * pushManifestDatabase - This function does the heavy lifting of taking new
 * data read from updated JSON files in xml/parsed (default location) and then
 * inserting that new data in the postgresql database.
 * @param {Array[Array, Array]} parsedInputs The two arrays contained in this
 * array will be the systems and components arrays respectively containing the
 * parsed JSON read from the system.
 * @param {knex} trx A knex query builder. We declared this in rebuildDatabase.
 * It will be used to perform transactions against the tables in our database
 */
async function pushManifestDatabase(parsedInputs, trx) {
  let systems = parsedInputs[0];
  let components = parsedInputs[1];

  // Insert the new systems data into the systems table in the database
  const insertSystems = await trx("systems")
    .insert(
      systems.map((system) => {
        let newSystem = {};
        Object.keys(system).forEach((systemKey) => {
          switch (systemKey) {
            case "Display":
              newSystem.name = system[systemKey];
              break;
            default:
              newSystem[camelToSnake(systemKey)] = system[systemKey];
              break;
          }
        });
        return newSystem;
      })
    )
    // If two systems have the same system id, which would generate a conflict
    // ignore the conflict and do nothing
    .onConflict("system_id")
    .ignore();

  // Make sure we actually have components to insert. If there are no systems to
  // insert then we won't have components.
  // TODO: Why is this '>=' and not > 0?
  // https://github.com/orgs/dell/projects/7/views/1?pane=issue&itemId=29635371
  if (insertSystems.rowCount >= 0) {

    for (let i = 0; i < components.length; i++) {
      let component = components[i];

      // Get all of the systems the component supports
      let compSystems = JSON.parse(
        JSON.stringify(components[i].SupportedSystems)
      );

      // Delete the original component's supported systems? TODO: Why?
      // https://github.com/orgs/dell/projects/7/views/1?pane=issue&itemId=29635391
      delete component.SupportedSystems;

      let insertPayload = {};

      for (let j = 0; j < Object.keys(component).length; j++) {
        var key = Object.keys(component)[j];
        let newKey = key.charAt(0).toLowerCase() + key.slice(1);
        if (key === "LUCategory") {
          newKey = "lu_category";
          insertPayload[newKey] = component[key];
        } else {
          insertPayload[camelToSnake(newKey)] = component[key];
        }
      }

      // TODO - The while loop doesn't work. The line 
      // delete insertPayload[key]; will run correctly and delete not 
      // compliant values but by the time componentInsertResults reruns, 
      // the value will return. I do not know why. 
      // https://github.com/grantcurell/patches/issues/32 
      delete insertPayload.f_mp_wrappers; 

      // This for loop handles the case that a new bundle key is added that
      // we don't support. It will be handled gracefully and not cause the 
      // import to fail.
      while(true) {
        try {
          const componentInsertsResults = await trx("components")
            .insert(insertPayload)
            .returning("id")
            .onConflict("hash_md5")
            .ignore()
            .then((comp) => {
              comp = comp[0];
              let compSystemsInsert = [];
              /* Reject null/duplicates to avoid extreme table sizes
              as the result of the component/componentsystems linkage

              in future put logging after the if statement checking the component

              // TODO - this seems to be important but I don't know what the
              original authors had in mind. https://github.com/orgs/dell/projects/7/views/1?pane=issue&itemId=29712915
              */
              if (comp) {
                compSystems.forEach((compSystem) => {
                  compSystemsInsert.push({
                    component_id: comp,
                    system_id: compSystem.systemID,
                  });
                });
                try {
                  return trx("component_systems").insert(compSystemsInsert);
                } catch (error) {
                  console.error(error);
                }
              }
            });

            break;
        } catch (error) {

          if (error.message.includes('does not exist')) {
            knex('components').columnInfo().then((componentColumns) => {
              Object.keys(insertPayload).forEach((key) => {
                console.debug(`DEBUG: Checking if ${key} is in insertPayload.`);
                if(!componentColumns.hasOwnProperty(key)) {
                  console.warn(`WARNING: While importing the components for ` +
                  `the repository's new XML the key ${key} was present in the` +
                  ` data found. This key is not part of our database schema.` +
                  ` So we were not able to add the component. You should ` +
                  `report this so it can be fixed. The exact error was ` +
                  `${error}`);
                  delete insertPayload[key];
                }
              });
            });
          } else {
            console.error(`Error: ${error.message}`);
          }
        }
      }
    }
    await trx.commit();
  } else {
    throw new Error("Insert systems transaction failed");
  }
}

/**
 * cleanDatabase - If we see via watchSetup that a repo no longer exists, this
 * is called to remove all of its data from the database.
 * @param {boolean} redirectFlag The current value of the redirect flag. The
 * redirect flag is set to true when we want to divert all traffic. Typically
 * this happens during a maintenance operation.
 * @returns {boolean} Returns the new value of the redirectFlag. It should be
 * false after this operation completes.
 */
module.exports.cleanDatabase = async (redirectFlag) => {
  let trx = await knex.transaction();
  try {
    const deleteComponents = await trx("components").del();
    if (deleteComponents >= 0) {
      const deleteSystems = await trx("systems").del();
      await trx.commit();
    } else {
      throw new Error("Components Delete transaction failed");
    }
  } catch (error) {
    console.error(`ERROR: There was an error while trying to cleanup the database. ` +
    `This function is called when we detect that a repo no longer exists and ` +
    `need to remove its data from the database. The error was: ${error}`)
    await trx.rollback(error);
    redirectFlag = false;
    return redirectFlag;
  }
}

/**
 * rebuildDatabase - Responsible for updating the database when new repos are
 * added
 * @param {*} currentXMLFile The current XML file for processing. This is the
 * repo XML file whose corresponding data we want to insert into the database
 * @param {*} redirectFlag The current value of the redirectFlag. See 
 * redirectFlag's definition for more info.
 * @returns {boolean} Returns a new value for the redirectFlag. After this 
 * finishes processing the new data the server should be ready and the
 * redirectFlag set to false.
 */
module.exports.rebuildDatabase = async (currentXMLFile, redirectFlag) => {

  // Create a transaction for use later
  // See https://knexjs.org/guide/transactions.html
  let trx = await knex.transaction();
  try {
    // Load the parsed JSON from disk into the parsedInputs variable in format
    // parsedInputs[systems_json_array, components_json_array]
    let parsedInputs = loadParsedManifest(currentXMLFile);

    // Push the parsed JSON into the database
    await pushManifestDatabase(parsedInputs, trx);
    console.info(`INFO: Successfully added data for ${currentXMLFile} to the database.`);

    // Disable client redirects if they were enabled
    redirectFlag = false;
    return redirectFlag;
  } catch (error) {
    console.error(`ERROR: While trying to update the database with the new ` +
    `system information from the XML file ` +
    `${parsed_path + "/" + currentXMLFile + '*.json'} we encountered a ` +
    `critical error. The error was: ${error}.`);
    await trx.rollback(error);
    redirectFlag = false;
    return redirectFlag;
  }
};

/**
 * Determines if the provided file is a repository folder.
 * A repository folder is identified by containing at least one XML file.
 * 
 * @param {*} file - The file object to be checked.
 * @returns {boolean} True if the file is a repository folder, otherwise false.
 */
function returnRepoFolder(file) {
  // Check if the file is a directory.
  if (file.isDirectory()) {
    // Construct the full path to the potential repository folder.
    let repoPath = path.join(repo_path, file.name);
    
    // Filter the contents of the directory to find XML files.
    let repoFolder = fs
      .readdirSync(repoPath, { withFileTypes: true })
      .filter((file) => path.extname(file.name) === ".xml")
      .find((e) => true); // It's unclear what the intention is with this find condition.

    // Return true if at least one XML file was found in the directory, indicating it's a repository folder.
    return repoFolder;
  } else {
    // If the file is not a directory, return false.
    return false;
  }
}

/**
 * Traverses the repository path and returns an array of repository folders.
 * Repository folders are determined based on a filtering function.
 * 
 * @returns {Array} An array of repository folders.
 */
module.exports.traverseXML = () => {
  let repoFolders = fs
    .readdirSync(repo_path, { withFileTypes: true })
    .filter((file) => returnRepoFolder(file));
  return repoFolders;
};
