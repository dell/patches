const stream = require("stream");

let rowCount = 0;

const csvTransform = (fields) =>
    new stream.Transform({
      objectMode: true,
      transform: (row, encoding, callback) => {
        let dbRow = [];

        if (rowCount == 0) {
          for (let j = 0; j < fields.length; j++) {
            dbRow.push(fields[j]);
          }
          dbRow.push("\n");
        }

        for (let i = 0; i < fields.length; i++) {
          if (typeof row[fields[i]] === "string") {
            if (row[fields[i]].includes(",")) {
              let existingRow = String(row[fields[i]]);
              let newRow = "";
              let position = row[fields[i]].indexOf(",");
              let index = [];

              while (position !== -1) {
                index.push(position);
                position = existingRow.indexOf(",", position + 1);
              }
              for (let i = 0; i <= index.length; i++) {
                if (i > 0) {
                  newRow =
                      newRow + existingRow.substring(index[i - 1] + 1, index[i]);
                } else {
                  newRow = existingRow.substring(i, index[i]);
                }
              }
              dbRow.push(newRow);
            } else {
              dbRow.push(row[fields[i]]);
            }
          } else {
            dbRow.push(row[fields[i]]);
          }
        }

        let returnRow = `${dbRow.join(",")}\n`;
        let firstCarriageIndex = returnRow.indexOf("\n");

        let index = [];
        let position = returnRow.indexOf("\n");
        while (position !== -1) {
          index.push(position);
          position = returnRow.indexOf("\n", position + 1);
        }
        if (index.length > 1) {
          returnRow =
              returnRow.slice(0, firstCarriageIndex - 1) +
              "\n" +
              returnRow.slice(firstCarriageIndex + 2, returnRow.length);
        }

        rowCount++;
        callback(null, returnRow);
      },
    });

const getComponents = (params) => {
  let { shid, system, statsQuery, search, fileType, versionQuery } = params || {};

  const stream = require("stream");

  let rowCount = 0;

  let componentQuery = knex("component_systems").join(
    "components",
    "components.id",
    "component_systems.component_id"
  );
  if (statsQuery) {
    if (fileType !== "All") {
      componentQuery.where("lu_category", "ILIKE", `%${fileType.trim()}%`);
      componentQuery.pluck("name").distinct();
    } else {
      componentQuery.pluck("name").distinct();
    }

    if (search) {
      componentQuery.where("name", "ILIKE", `%${search.trim()}%`);
    }

    if (system) componentQuery.where("component_systems.system_id", system);

    return componentQuery.select("name");
  }
  
  if (versionQuery) {
    let componentQuery = knex("components");
    componentQuery.where("xml_file_name", "ILIKE", `%${versionQuery.trim()}%`);
    if(search){
      componentQuery.where("name", "ILIKE", `%${search.trim()}%`)
          .orWhere("vendor_version", "ILIKE", `%${search.trim()}%`)
          .orWhere("package_type", "ILIKE", `%${search.trim()}%`)
          .orWhere("package_id", "ILIKE", `%${search.trim()}%`)
          .orWhere("dell_version", "ILIKE", `%${search.trim()}%`)
          .orWhere("lu_category", "ILIKE", `%${search.trim()}%`)
          .orWhere("description", "ILIKE", `%${search.trim()}%`);
    }
    return componentQuery.select("*");
  }

  // if (id) componentQuery.where('components.id', id)
  if (system) componentQuery.where("component_systems.system_id", system);
  
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

  app.get("/api/components/csv", (req, res) => {
    let { csv, versionQuery, search } = req.query || {};
    if(csv){
      res.set("content-type", "text/csv");
      res.attachment("patches_driver_details_" + versionQuery + "search_query_" + search +".csv");
      queryStream = getComponents(req.query).stream();

      queryStream.pipe(
              csvTransform([
                "name",
                "description",
                "dell_version",
                "vendor_version",
                "release_date",
                "package_type",
              ])
          )
          .pipe(res);
      rowCount = 0;
    }
  });
};
