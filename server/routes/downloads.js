const stream = require("stream");
const download_path = process.env.REPO_PATH;
const path = require("path");

let rowCount = 0;

function processTimePeriodQuery(tp, start, end) {
  let ts = Date.now();

  if (tp === "week") {
    /* one week in epoch elapsed ms */
    let week = 604800000;
    let previous_ts = ts - week;

    let startDate_obj = new Date(previous_ts).toISOString();
    let endDate_obj = new Date(ts).toISOString();

    return {
      startDate: startDate_obj.substr(0, startDate_obj.indexOf("T")),
      endDate: endDate_obj.substr(0, endDate_obj.indexOf("T")),
    };
  } else if (tp === "month") {
    /* one month in epoch elapsed ms */
    let month = 2628000000;
    let previous_ts = ts - month;

    let startDate_obj = new Date(previous_ts).toISOString();
    let endDate_obj = new Date(ts).toISOString();

    return {
      startDate: startDate_obj.substr(0, startDate_obj.indexOf("T")),
      endDate: endDate_obj.substr(0, endDate_obj.indexOf("T")),
    };
  } else if (tp === "quarter") {
    let current_date = new Date(ts);

    /* current month, getMonth is 0-11 index (0 is Jan) */
    let current_month = current_date.getMonth() + 1;
    let current_year = current_date.getFullYear();

    if (current_month <= 12 && current_month >= 10) {
      return {
        startDate: `${current_year}-10-01`,
        endDate: `${current_year}-12-31`,
      };
    } else if (current_month <= 9 && current_month >= 7) {
      return {
        startDate: `${current_year}-07-01`,
        endDate: `${current_year}-09-30`,
      };
    } else if (current_month <= 6 && current_month >= 4) {
      return {
        startDate: `${current_year}-04-01`,
        endDate: `${current_year}-06-30`,
      };
    } else {
      return {
        startDate: `${current_year}-01-01`,
        endDate: `${current_year}-03-31`,
      };
    }
  } else if (tp === "custom" && start && end) {
    return {
      startDate: `${start.substr(0, start.indexOf("T"))}`,
      endDate: `${end.substr(0, end.indexOf("T"))}`,
    };
  }
}

const getDownloads = (params) => {
  let { id, organizationalUnit, organization, country } = params || {};

  let downloadQuery = knex("user_downloads").join(
    "users",
    "users.name",
    "user_downloads.user"
  );

  console.log(downloadQuery.toString());

  if (id) downloadQuery.where("user_downloads.name", id);
  if (organizationalUnit)
    downloadQuery.where("users.organizational_unit", organizationalUnit);
  if (organization) downloadQuery.where("users.organization", organization);
  if (country) downloadQuery.where("users.country_name", country);

  return downloadQuery.select("*");
};

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

module.exports = (app) => {
  app.get("/api/download", (req, res) => {
    let { component } = req.query;
    // Authenticate User

    // Get component path
    knex("components")
      .select("path")
      .where("id", component)
      .first()
      .then((comp) => {
        knex("user_downloads")
          .insert({
            component_id: component,
            user: req.user.subject,
          })
          .then(() => {
            let downloadPath = path.join(download_path, comp.path);
            res.download(downloadPath);
          })
          .catch((err) => {
            res.send({ error: err });
          });
      });
  });

  app.get("/api/downloads", (req, res) => {
    getDownloads(req.query)
      .then((downloads) => {
        res.send({ downloads });
      })
      .catch((err) => {
        res.send({ error: err });
      });
  });

  app.get("/api/downloads/count", (req, res) => {
    let { group, user, ou, tp, start, end, fileType, file, csv } =
      req.query || {};

    let queryChoiceString = "";

    let downloadQuery = knex("user_downloads")
      .join("users", "users.name", "user_downloads.user")
      .join("components", "components.id", "user_downloads.component_id");

    if (!csv) {
      switch (group) {
        case "name":
          downloadQuery.select("users.name").groupBy("users.name");
          break;
        case "organizational_unit":
          downloadQuery
            .select("users.organizational_unit")
            .groupBy("users.organizational_unit");
          break;
        case "organization":
          downloadQuery
            .select("users.organization")
            .groupBy("users.organization");
          break;
        case "country":
          downloadQuery.select("users.country").groupBy("users.country");
          break;
        case "category":
          downloadQuery
            .select("components.lu_category as category")
            .groupBy("components.lu_category");
          break;
        default:
          downloadQuery
            .select("components.lu_category as category")
            .groupBy("components.lu_category");
          break;
      }
    }

    if (user) {
      downloadQuery.where("users.name", user);
      queryChoiceString += "user=" + user + "||";
    }

    if (ou) {
      downloadQuery.where("users.organizational_unit", ou);
      queryChoiceString += "organizational_unit=" + ou + "||";
    }

    if (tp !== "all" && tp) {
      queryChoiceString += "timePeriod=" + tp + "||";
      dateFilter = processTimePeriodQuery(tp, start, end);
      downloadQuery
        .where("user_downloads.created_at", ">=", dateFilter.startDate)
        .andWhere("user_downloads.created_at", "<=", dateFilter.endDate);
    }

    if (fileType && fileType !== "All") {
      queryChoiceString += "fileType=" + fileType + "||";
      downloadQuery.where("components.lu_category", fileType).orderBy("name");
    }

    if (file) {
      queryChoiceString += "file=" + file + "||";
      downloadQuery.where("components.name", file);
    }

    if (csv) {
      res.set("content-type", "text/csv");
      res.attachment("patches_statistics_" + queryChoiceString + ".csv");
      downloadQuery.select(
        "user",
        "organizational_unit",
        "organization",
        "country",
        "user_downloads.created_at AS user_downloaded_at",
        "components.name",
        "lu_category",
        "hash_md5",
        "package_type",
        "release_id",
        "vendor_version"
      );

      let queryStream = downloadQuery.stream();
      queryStream
        .pipe(
          csvTransform([
            "user",
            "organizational_unit",
            "organization",
            "country",
            "user_downloaded_at",
            "name",
            "lu_category",
            "hash_md5",
            "package_type",
            "release_id",
            "vendor_version",
          ])
        )
        .pipe(res);
      /* reset csv row counts for transform after piped */
      rowCount = 0;
    } else {
      /* If not a CSV report download, return count for stats*/
      downloadQuery.select(knex.raw("count(*)::integer"));

      downloadQuery
        .then((downloads) => {
          res.send({ downloads });
        })
        .catch((err) => {
          res.send({ error: err });
        });
    }
  });
};
