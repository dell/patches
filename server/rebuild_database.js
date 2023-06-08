if (process.env.NODE_ENV !== "production") require("dotenv").config();
const fs = require("fs");
const path = require("path");
const parsed_path = process.env.PARSED_PATH;
const repo_path = process.env.REPO_PATH;

knex = require("./db");

function camelToSnake(string) {
  return string
    .replace(/[\w]([A-Z])/g, function (m) {
      return m[0] + "_" + m[1];
    })
    .toLowerCase();
}

function loadParsedManifest(currentXMLFile) {
  let systems = "";
  let components = "";
  try {
    systems = fs.readFileSync(
      parsed_path + `/${currentXMLFile}_systems.json`,
      "utf16le"
    );
    systems = JSON.parse(systems);
    components = fs.readFileSync(
      parsed_path + `/${currentXMLFile}_components.json`,
      "utf16le"
    );
    components = JSON.parse(components);
  } catch (err) {
    console.log(err);
  }

  return [systems, components];
}

async function pushManifestDatabase(parsedInputs, trx) {
  let systems = parsedInputs[0];
  let components = parsedInputs[1];
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
    .onConflict("system_id")
    .ignore();

  if (insertSystems.rowCount >= 0) {
    let componentInserts = [];
    for (let i = 0; i < components.length; i++) {
      let component = components[i];
      let compSystems = JSON.parse(
        JSON.stringify(components[i].SupportedSystems)
      );

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
              console.log(error);
            }
          }
        });
    }
    await trx.commit();
  } else {
    throw new Error("Insert systems transaction failed");
  }
}

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
    await trx.rollback(error);
    redirectFlag = false;
    return redirectFlag;
  }
}

module.exports.rebuildDatabase = async (currentXMLFile, redirectFlag) => {
  let trx = await knex.transaction();
  try {
    let parsedInputs = loadParsedManifest(currentXMLFile);
    await pushManifestDatabase(parsedInputs, trx);
    /*const deleteComponents = await trx("components").del();
    if (deleteComponents >= 0) {
      const deleteSystems = await trx("systems").del();
      if (deleteSystems >= 0) {
        let parsedInputs = loadParsedManifest(currentXMLFile);
        await pushManifestDatabase(parsedInputs, trx);
      } else {
        throw new Error("Systems delete transaction failed");
      }
      await trx.commit();
    } else {
      throw new Error("Components Delete transaction failed");
    }*/
    await trx.commit();
    redirectFlag = false;
    return redirectFlag;
  } catch (error) {
    await trx.rollback(error);
    redirectFlag = false;
    return redirectFlag;
  }
};

function returnRepoFolder(file) {
  if (file.isDirectory()) {
    let repoPath = path.join(repo_path, file.name);
    let repoFolder = fs
      .readdirSync(repoPath, { withFileTypes: true })
      .filter((file) => path.extname(file.name) === ".xml")
      .find((e) => true);
    return repoFolder;
  }
}

module.exports.traverseXML = () => {
  let repoFolders = fs
    .readdirSync(repo_path, { withFileTypes: true })
    .filter((file) => returnRepoFolder(file));
  return repoFolders;
};
