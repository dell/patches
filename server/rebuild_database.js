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

  // This code is responsible for inserting data into the "systems" table of the database
  // using the `knex` query builder with the `trx` transaction object.
  const insertSystems = await trx("systems")
    // Use the `.insert()` method to insert data into the "systems" table.
    .insert(
      // For each system object in the `systems` array, this code creates a new object `newSystem`
      // and processes the properties of the original system object.
      systems.map((system) => {
        // Create a new object to store the modified data.
        let newSystem = {};

        // Iterate over each property (key) of the `system` object.
        Object.keys(system).forEach((systemKey) => {
          // Handle different properties based on their keys using a `switch` statement.

          // If the property is "Display", assign its value to the `name` property of the `newSystem` object.
          // This effectively renames the "Display" property to "name".
          switch (systemKey) {
            case "Display":
              newSystem.name = system[systemKey];
              break;

            // For other properties (not "Display"), use the `camelToSnake()` function to convert the
            // property key from camelCase to snake_case and assign the corresponding value to the `newSystem` object.
            // This step effectively transforms the keys of the object from camelCase to snake_case.
            default:
              newSystem[camelToSnake(systemKey)] = system[systemKey];
              break;
          }
        });

        // Return the modified `newSystem` object for insertion into the "systems" table.
        return newSystem;
      })
    )
    // If two systems have the same "system_id", which would generate a conflict during insertion,
    // this part of the code specifies to ignore the conflict and do nothing.
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

      // Create an empty object to store the payload data for inserting into the "components" table.
      let insertPayload = {};

      // Loop through each property (key) of the `component` object.
      for (let j = 0; j < Object.keys(component).length; j++) {
        // Get the current key (property name) from the `component` object.
        var key = Object.keys(component)[j];

        // Convert the key from camelCase to snake_case and store it in the `newKey` variable.
        let newKey = key.charAt(0).toLowerCase() + key.slice(1);

        // Handle a special case for the "LUCategory" property: Rename it to "lu_category".
        if (key === "LUCategory") {
          newKey = "lu_category";
          // Add the renamed property and its value to the `insertPayload` object.
          insertPayload[newKey] = component[key];
        } else {
          // For properties other than "LUCategory", use the `camelToSnake()` function (not shown here) to convert the key to snake_case,
          // and add the property and its value to the `insertPayload` object.
          insertPayload[camelToSnake(newKey)] = component[key];
        }
      }

      try {
        // Insert the `insertPayload` data into the "components" table.
        // Use the `returning` method to return the ID of the inserted component after the insertion.
        // If there is a conflict with an existing component (determined by the "hash_md5" column),
        // ignore the conflict and do nothing.
        const componentInsertsResults = await trx("components")
          .insert(insertPayload)
          .returning("id")
          .onConflict("hash_md5")
          .ignore()
          .then((comp) => {
            // The `then` block is executed after the insertion is successful.
            // The `comp` variable holds the ID of the inserted component.
            // See https://github.com/dell/patches/issues/14
            // In some versions of the schema comp[0] is a dictionary, in others it is an int. Here we account for this
            comp = typeof comp[0] === 'object' ? comp[0].id : comp[0];
      
            // Create an empty array to store the payload data for inserting into the "component_systems" table.
            let compSystemsInsert = [];
      
            /* 
              Reject null/duplicates to avoid extreme table sizes
              as the result of the component/componentsystems linkage
            */
            if (comp) {
      
              // Loop through each supported system of the component (compSystems).
              compSystems.forEach((compSystem) => {
                // Get the system ID directly from the compSystem object.
                const systemId = compSystem.systemID;
                // Add the payload for linking the component and system to the `compSystemsInsert` array.
                compSystemsInsert.push({
                  component_id: comp, // Use the component's ID
                  system_id: systemId,       // Use the system's ID
                });
              });
      
              try {
                // Insert the `compSystemsInsert` data into the "component_systems" table,
                // linking the component to its supported systems.
                return trx("component_systems").insert(compSystemsInsert);
              } catch (error) {
                console.error(`Error inserting into component_systems: ${error.message}`);
              }
            }
          });
      } catch (error) {
        // If an error occurs during the insertion process, log the error message.
        console.error(`Error inserting into components: ${error.message}`);
        
        // Print the description of the component causing the conflict
        console.error(`Component description causing conflict: ${insertPayload.description}`);
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
