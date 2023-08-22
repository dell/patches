const logger = require('../logger');
const fastcsv = require("fast-csv");

const getComponents = (params) => {
  // Destructure the parameters or set default empty values
  let { shid, system, statsQuery, search, fileType, versionQuery } = params || {};

  // Log a debug message indicating the version query
  logger.debug(`Getting components for ${versionQuery}`);

  // Create the base component query joining "component_systems" and "components" tables
  let componentQuery = knex("component_systems").join(
    "components",
    "components.id",
    "component_systems.component_id"
  );

  // If statsQuery is true, perform statistical query
  if (statsQuery) {
    if (fileType !== "All") {
      // Filter components by lu_category if fileType is specified
      componentQuery.where("lu_category", "ILIKE", `%${fileType.trim()}%`);
      componentQuery.pluck("name").distinct(); // Select distinct names
    } else {
      componentQuery.pluck("name").distinct(); // Select distinct names
    }

    if (search) {
      // Filter components by name if search is specified
      componentQuery.where("name", "ILIKE", `%${search.trim()}%`);
    }

    if (system) {
      // Filter components by system if system is specified
      componentQuery.where("component_systems.system_id", system);
    }

    // Return the query result containing distinct component names
    return componentQuery.select("name");
  }
  
  // If versionQuery is provided, perform version query
  if (versionQuery) {
    let componentQuery = knex("components");
    // Filter components by xml_file_name if versionQuery is specified
    componentQuery.where("xml_file_name", "ILIKE", `%${versionQuery.trim()}%`);

    if (search) {
      // Filter components by multiple fields if search is specified
      componentQuery.where("name", "ILIKE", `%${search.trim()}%`)
          .orWhere("vendor_version", "ILIKE", `%${search.trim()}%`)
          .orWhere("package_type", "ILIKE", `%${search.trim()}%`)
          .orWhere("package_id", "ILIKE", `%${search.trim()}%`)
          .orWhere("dell_version", "ILIKE", `%${search.trim()}%`)
          .orWhere("lu_category", "ILIKE", `%${search.trim()}%`)
          .orWhere("description", "ILIKE", `%${search.trim()}%`);
    }

    // Return the query result containing components matching versionQuery and search
    return componentQuery.select("*");
  }

  if (system) {
    // Filter components by system if system is specified
    componentQuery.where("component_systems.system_id", system);
  }

  // Return the query result containing all components
  return componentQuery.select("*");
};

module.exports = (app) => {
  app.get("/api/components", (req, res) => {
    getComponents(req.query)
      .then((components) => {
        res.send({ components });
      })
      .catch((err) => {
        res.send({ error: err });
      });
  });

  app.get("/api/components/csv", async (req, res) => {
    let { csv, versionQuery, search } = req.query || {};
    logger.info(`Received CSV download request for ${versionQuery}`);
    if (csv) {
      res.set("content-type", "text/csv");
      res.attachment(
        "patches_driver_details_" + versionQuery + "search_query_" + search + ".csv"
      );
  
      try {
        const components = await getComponents(req.query);
  
        // Create a writable stream to write CSV data
        const csvStream = fastcsv.format({ headers: true });
  
        // Pipe the CSV data to the response
        csvStream.pipe(res);
  
        // Write the components data to the CSV stream
        components.forEach((component) => {
          csvStream.write(component);
        });
  
        csvStream.end(); // End the CSV stream
  
      } catch (error) {
        res.send({ error: error.message });
      }
    }
  });
};
