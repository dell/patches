const download_path = process.env.REPO_PATH;
const path = require("path");
const logger = require('../logger');
const fastcsv = require('fast-csv');

/**
 * Processes the time period query based on the given parameters.
 *
 * @param {string} tp - Time period type: 'week', 'month', 'quarter', or 'custom'.
 * @param {string} start - Start date in ISO format (e.g., '2023-08-01T00:00:00.000Z').
 * @param {string} end - End date in ISO format (e.g., '2023-08-31T23:59:59.999Z').
 * @returns {Object} - Object containing the start and end dates, including timezone offset.
 */
function processTimePeriodQuery(tp, start, end) {
  // Get the current timestamp in milliseconds since Unix epoch
  let ts = Date.now();

  if (tp === "week") {
    // Calculate one week in milliseconds
    const week = 604800000;
    let previous_ts = ts - week;

    // Convert timestamps to ISO format strings with timezone offset
    let startDate_obj = new Date(previous_ts).toISOString();
    let endDate_obj = new Date(ts).toISOString();

    return {
      startDate: startDate_obj,
      endDate: endDate_obj,
    };
  } else if (tp === "month") {
    // Calculate one month in milliseconds
    const month = 2628000000;
    let previous_ts = ts - month;

    // Convert timestamps to ISO format strings with timezone offset
    let startDate_obj = new Date(previous_ts).toISOString();
    let endDate_obj = new Date(ts).toISOString();

    return {
      startDate: startDate_obj,
      endDate: endDate_obj,
    };
  } else if (tp === "quarter") {
    let current_date = new Date(ts);

    // Get the current month and year
    let current_month = current_date.getMonth() + 1;
    let current_year = current_date.getFullYear();

    if (current_month <= 12 && current_month >= 10) {
      // Return start and end dates for the October-December quarter
      return {
        startDate: `${current_year}-10-01`,
        endDate: `${current_year}-12-31`,
      };
    } else if (current_month <= 9 && current_month >= 7) {
      // Return start and end dates for the July-September quarter
      return {
        startDate: `${current_year}-07-01`,
        endDate: `${current_year}-09-30`,
      };
    } else if (current_month <= 6 && current_month >= 4) {
      // Return start and end dates for the April-June quarter
      return {
        startDate: `${current_year}-04-01`,
        endDate: `${current_year}-06-30`,
      };
    } else {
      // Return start and end dates for the January-March quarter
      return {
        startDate: `${current_year}-01-01`,
        endDate: `${current_year}-03-31`,
      };
    }
  } else if (tp === "custom" && start && end) {
    // Return the provided start and end dates as they are
    return {
      startDate: start,
      endDate: end,
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

  logger.info(downloadQuery.toString());

  if (id) downloadQuery.where("user_downloads.name", id);
  if (organizationalUnit)
    downloadQuery.where("users.organizational_unit", organizationalUnit);
  if (organization) downloadQuery.where("users.organization", organization);
  if (country) downloadQuery.where("users.country_name", country);

  return downloadQuery.select("*");
};

module.exports = (app) => {
  // Endpoint to handle component downloads
  app.get("/api/download", (req, res) => {
    let { component } = req.query;

    // Authenticate User

    // Get component path from the database
    knex("components")
      .select("path")
      .where("id", component)
      .first()
      .then((comp) => {
        // Insert a record in the user_downloads table
        knex("user_downloads")
          .insert({
            component_id: component,
            user: req.user.subject,
          })
          .then(() => {
            // Construct the download path
            let downloadPath = path.join(download_path, comp.path);

            // Trigger the download for the user
            res.download(downloadPath);
          })
          .catch((err) => {
            res.send({ error: err });
          });
      });
  });

  // Endpoint to fetch user downloads
  app.get("/api/downloads", (req, res) => {
    getDownloads(req.query)
      .then((downloads) => {
        res.send({ downloads });
      })
      .catch((err) => {
        res.send({ error: err });
      });
  });

  // Endpoint to fetch download counts and generate CSV reports
  app.get("/api/downloads/count", (req, res) => {
    const { group, user, ou, tp, start, end, fileType, file, csv } = req.query || {};

    let queryChoiceString = "";

    // Initialize the base downloadQuery
    let downloadQuery = knex("user_downloads")
      .join("users", "users.name", "user_downloads.user")
      .join("components", "components.id", "user_downloads.component_id");

    logger.debug(`New table being created with query: ${downloadQuery.toSQL().toNative().sql}`);

    if (!csv) {
      // Handle non-CSV report requests
      switch (group) {
        case "name":
          downloadQuery.select("users.name").groupBy("users.name");
          break;
        case "organizational_unit":
          downloadQuery.select("users.organizational_unit").groupBy("users.organizational_unit");
          break;
        case "organization":
          downloadQuery.select("users.organization").groupBy("users.organization");
          break;
        case "country":
          downloadQuery.select("users.country").groupBy("users.country");
          break;
        case "category":
          downloadQuery.select("components.lu_category as category").groupBy("components.lu_category");
          break;
        default:
          downloadQuery.select("components.lu_category as category").groupBy("components.lu_category");
          break;
      }
    }

    if (user) {
      // Filter by user if specified
      downloadQuery.where("users.name", user);
      queryChoiceString += "user=" + user + "||";
    }

    if (ou) {
      // Filter by organizational unit if specified
      downloadQuery.where("users.organizational_unit", ou);
      queryChoiceString += "organizational_unit=" + ou + "||";
    }

    if (tp !== "all" && tp) {
      // Filter by time period if specified
      queryChoiceString += "timePeriod=" + tp + "||";
      dateFilter = processTimePeriodQuery(tp, start, end);
      logger.debug(`downloadQuery before tp update: ${downloadQuery}`)
      downloadQuery
        .where("user_downloads.created_at", ">=", dateFilter.startDate)
        .andWhere("user_downloads.created_at", "<=", dateFilter.endDate);
      logger.debug(`downloadQuery after tp update: ${downloadQuery}`);
    }

    if (fileType && fileType !== "All") {
      // Filter by file type if specified
      queryChoiceString += "fileType=" + fileType + "||";
      downloadQuery.where("components.lu_category", fileType).orderBy("name");
    }

    if (file) {
      // Filter by file name if specified
      queryChoiceString += "file=" + file + "||";
      downloadQuery.where("components.name", file);
    }

    if (csv) {
      // Handle CSV report requests
      res.set("content-type", "text/csv");
      res.attachment("patches_statistics_" + queryChoiceString + ".csv");

      // Define the headers for the CSV
      const csvHeaders = [
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
      ];

      // Get the raw SQL query
      const rawSqlQuery = downloadQuery.toSQL().toNative().sql;
      logger.debug(`Raw CSV query is: ${rawSqlQuery}`);

      // Execute the SQL query to fetch data
      downloadQuery
        .then((rows) => {
          // Create a writable stream to write CSV data
          const csvStream = fastcsv.format({ headers: csvHeaders, objectMode: true });

          // Pipe the CSV stream directly to the response
          csvStream.pipe(res);

          // Write the CSV headers
          csvStream.write({});

          // Write each row of data to the CSV stream
          rows.forEach((row) => {
            csvStream.write(row);
          });

          csvStream.end(); // End the CSV stream
        })
        .catch((err) => {
          res.send({ error: err });
        });
    } else {
      /* If not a CSV report download, return count for stats */
      downloadQuery.select(knex.raw("count(*)::integer"));
      logger.debug(`Raw query is: ${downloadQuery.select(knex.raw("count(*)::integer")).toQuery()}`);

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
