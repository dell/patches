if (process.env.NODE_ENV !== "production") require("dotenv").config();
const fs = require("fs");
const xml2js = require("xml2js");
const path = require("path");

const parser = new xml2js.Parser();
const parsed_path = process.env.PARSED_PATH;

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
  /*return Object.keys(devices).map((d) => devices[d]);*/
  let flattened = temp_wrap;
  temp_wrap = [];
  return flattened;
};

const parseComponents = (catalog, folderName, xml_file) => {
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
module.exports.parseCatalog = (xmlFile, repo_path, folderName) => {
  let catalog = {};
  let xmlFileIdent = xmlFile.name.split("_")[0];

  fs.readFile(path.join(repo_path, xmlFile.name), "utf-16le", (err, data) => {

    if (err) {
      console.error(`ERROR: Patches encountered an error while processing the 
      repository XML file for the repository 
      ${path.join(repo_path, xmlFile.name)}. The error was ${err}.`);
    }

    parser.parseString(data, (err, result) => {
      catalog = result;
    });

    let parsed = {
      systems: parseSystems(catalog),
      devices: parseDevices(catalog),
      components: parseComponents(catalog, folderName, xmlFile.name),
      bundles: parseBundles(catalog),
    };

    Object.keys(parsed).forEach((item) => {
      fs.writeFileSync(
        path.join(parsed_path, `${xmlFileIdent}_${item}.json`),
        JSON.stringify(parsed[item], space=2),
        "utf8",
        () => {
          console.info(`INFO: ${item} finished`);
        }
      );
    });
  });
};
