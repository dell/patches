import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import qs from 'qs';
import http from '../../http';
import Select from 'react-select';
import AsyncSelect from 'react-select/async';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import {
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  ResponsiveContainer,
} from 'recharts';
import { parseISO } from 'date-fns';

// These are the options in the "Group By" selector
const groupOptions = [
  { label: "Category", value: "category" },
  { label: "Users", value: "name" },
  { label: "Organizational Unit", value: "organizational_unit" },
  { label: "Organization", value: "organization" },
  { label: "Country", value: "country" },
];

const timePeriodOptions = [
  { label: "Last Week", value: "week" },
  { label: "Last Month", value: "month" },
  { label: "Last Quarter", value: "quarter" },
  { label: "All", value: "all" },
  { label: "Custom", value: "custom" },
];

const fileTypeOptions = [
  { label: "All Types", value: "All" },
  { label: "Firmware", value: "Firmware" },
  { label: "SAS Drive", value: "SAS Drive" },
  {
    label: "iDRAC with Lifecycle Controller",
    value: "iDRAC with Lifecycle Controller",
  },
  { label: "NONE", value: "NONE" },
  { label: "Storage", value: "Storage" },
  { label: "SAS RAID", value: "SAS RAID" },
  { label: "BIOS", value: "BIOS" },
  { label: "SAS Non-RAID", value: "SAS Non-RAID" },
  { label: "Video", value: "Video" },
  { label: "Express Flash PCIe SSD", value: "Express Flash PCIe SSD" },
  { label: "Drivers for OS Deployment", value: "Drivers for OS Deployment" },
  { label: "Serial ATA", value: "Serial ATA" },
  { label: "Diagnostics", value: "Diagnostics" },
  { label: "Systems Management", value: "Systems Management" },
  { label: "Memory", value: "Memory" },
  { label: "Network", value: "Network" },
  { label: "Fibre Channel", value: "Fibre Channel" },
  { label: "Chipset", value: "Chipset" },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [state, setState] = useState({
    group: groupOptions[0],
    groupByChoice: null,
    fileType: fileTypeOptions[0],
    downloads: [],
    userFilter: '',
    ouFilter: '',
    file: '',
    timePeriod: timePeriodOptions[3],
    customTimePeriod: null,
    startDate: null,
    endDate: null,
  });

  useEffect(() => {
    // This useEffect block is responsible for setting up the initial state of the dashboard filters
    // based on the query parameters in the URL. It also triggers fetching data after setting up the state. This will
    // run anytime the URL updates

    const { newState, qsParams } = parseURLParameters();

    // Update the state with the new values
    setState(newState);
    
    http
      .get(`/api/downloads/count?${qs.stringify(qsParams)}`)
      .then((res) => {
        // Update state with downloaded data if 'downloads' property exists in the response
        if (res.downloads) {
          setState((prevState) => ({
            ...prevState,                // Spread the previous state properties
            downloads: res.downloads     // Update the 'downloads' property
          }));          
        }
      })
      .catch((error) => {
        // Handle any errors from the HTTP request here
        console.error("Error fetching data:", error);
      });
  }, [location.search]); // Adding location.search as a dependency for useEffect

  /**
   * Parses query parameters from the URL and updates state and query parameters accordingly.
   * Assumes that necessary variables are defined in the surrounding scope.
   *
   * @returns {object} - An object containing `newState` and `qsParams`.
   */
  function parseURLParameters() {
    // Parse the query parameters from the URL
    let params = qs.parse(location.search.substring(1));
    let newState = {}; // Object to store the new state
    let qsParams = {}; // Object to store query parameters

    // Check if the 'group' parameter is present in the URL
    if (params.group) {
      // Find the corresponding group option and set it in the state
      newState.group = groupOptions.find((g) => g.value === params.group);
      qsParams.group = params.group;

      // Determine whether groupByChoice should be enabled or not
      if (params.group === "category") {
        newState.groupByChoice = null; // Clear groupByChoice for 'Category'

        // If 'fileType' or 'file' parameters are present, update the search
        if (params.fileType || params.file) {
          updateSearch({}, ['fileType', 'file']);
        }
      } else {
        newState.groupByChoice = true; // Set groupByChoice for other options
      }
    }

    // Check if the 'user' parameter is present in the URL
    if (params.user) {
      // Set the user filter in the state based on the 'user' parameter
      newState.userFilter = {
        label: params.user,
        value: { name: params.user },
      };
      qsParams.user = params.user;
      state.userFilter = params.user;
    }

    // Check if the 'ou' parameter is present in the URL
    if (params.ou) {
      // Set the organizational unit filter in the state based on the 'ou' parameter
      newState.ouFilter = { label: params.ou, value: params.ou };
      qsParams.ou = ouFilter.value;
    }

    // Check if the 'timePeriod' parameter is present in the URL
    if (params.timePeriod) {
      // Set the time period filter in the state based on the 'timePeriod' parameter
      newState.timePeriod = timePeriodOptions.find(
        (t) => t.value === params.timePeriod
      );
      qsParams.tp = params.timePeriod;

      // If the selected time period is 'custom', add start and end dates
      if (params.timePeriod === "custom" && (params.startDate || params.endDate)) {
        // Add 'start' and 'end' parameters to query parameters
        qsParams.start = params.startDate;
        qsParams.end = params.endDate;

        // Enable customTimePeriod and update the state with the selected option
        newState.customTimePeriod = true;

        // Parse start date string into a date object if it exists
        newState.startDate = params.startDate ? parseISO(params.startDate) : null;

        // Parse end date string into a date object if it exists
        newState.endDate = params.endDate ? parseISO(params.endDate) : null; 
      } else {
        // Disable customTimePeriod and set dates to null
        newState.customTimePeriod = false;
        newState.startDate = null;
        newState.endDate = null;
      }
    }

    // Check if the 'fileType' parameter is present in the URL
    if (params.fileType) {
      // Add 'fileType' parameter to query parameters
      qsParams.fileType = params.fileType;

      // Set 'fileType' in the state with label and value
      newState.fileType = { label: params.fileType, value: params.fileType };    
    }
    
    // Check if the 'file' parameter is present in the URL
    if (params.file) {
      // Add 'file' parameter to query parameters
      qsParams.file = params.file;

      // Set 'file' in the state with label and value
      newState.file = { label: params.file, value: params.file };
    }

    // Return the updated 'newState' and 'qsParams'
    return { newState, qsParams };
  }

  /**
   * Updates the URL search parameters based on new parameters and removes specified parameters.
   * Navigates to the updated URL with the modified search parameters.
   * @param {Object} newParams - The new parameters to be added or updated in the URL search.
   * @param {Array} removeParams - An optional array of parameter keys to be removed from the URL search.
   */
  function updateSearch(newParams, removeParams = []) {
    // Parse the current URL search parameters
    const params = qs.parse(location.search.substring(1));

    // Remove specified parameters from the params object
    removeParams.forEach((key) => delete params[key]);

    // Navigate to the updated URL with the modified search parameters
    navigate({
      pathname: "",
      search: qs.stringify({
        ...params,
        ...newParams,
      }),
    });
  }

  /**
   * Handles the change event when the "Time Period" selector value is changed.
   * Updates the state and triggers actions based on the selected time period option.
   * @param {Object} option - The selected option from the "Time Period" selector.
   */
  function handleTimePeriodChange(option) {
    if (option.value === "custom") {
      // Update the URL search parameters with custom time period and refresh data
      const startDate = option.startDate || new Date(0); // Beginning of time
      const endDate = option.endDate || new Date(); // Current date and time
      updateSearch({
        timePeriod: "custom",
        startDate: new Date(startDate.setHours(0, 0, 0, 0)).toISOString(),
        endDate: new Date(endDate.setHours(23, 59, 59, 999)).toISOString(),
      });
    } else {
      updateSearch({timePeriod: option.value}, ['startDate', 'endDate']);
    }
  }

  /**
   * Sets the state to trigger CSV download and refreshes data.
   */
  function getCSV() {

    const { newState, qsParams } = parseURLParameters();

    qsParams.csv = true;

    window.open(`/api/downloads/count?${qs.stringify(qsParams)}`);
    return null;
  }

   // A timeout reference for searching users asynchronously.
  let searchTimeout = null;

  /**
   * Searches for users based on the provided input value and calls the callback with the results.
   * @param {string} inputValue - The input value to search for.
   * @param {function} callback - The callback function to return the search results.
   */
  function searchUsers(inputValue, callback) {
    // Clear any existing search timeout to avoid rapid firing of requests
    clearTimeout(searchTimeout);
  
    // Set a new timeout to perform the search after a delay of 1000ms (1 second)
    searchTimeout = setTimeout(() => {
      // Make an HTTP GET request to search for users with the given input value
      http.get(`/api/users?search=${inputValue}`).then((res) => {
        // Extract and transform the user data from the response into a format suitable for the callback
        callback(
          res.users.map((user) => ({
            value: user,          // The user data object
            label: user.name,    // Display label for the user in the dropdown
          }))
        );
      });
    }, 1000); // Set the delay for the search to be executed after 1 second
  };

  // A timeout reference for searching organizational units asynchronously.
  let ouTimeout = null;

  /**
   * Searches for organizational units based on the provided input value and calls the callback with the results.
   * @param {string} inputValue - The input value to search for.
   * @param {function} callback - The callback function to return the search results.
   */
  function searchOU(inputValue, callback) {
    // Clear any existing timeout to avoid rapid firing of requests
    clearTimeout(ouTimeout);
  
    // Set a new timeout to perform the search after a delay of 1000ms (1 second)
    ouTimeout = setTimeout(function() {
      // Make an HTTP GET request to search for organizational units with the given input value
      http.get(`/api/organizational_units?search=${inputValue}`).then(function(res) {
        // Extract and transform the organizational unit data from the response into a format suitable for the callback
        callback(
          res.organizational_units.map(function(org) {
            return {
              value: org,          // The organizational unit data
              label: org,          // Display label for the organizational unit in the dropdown
            };
          })
        );
      });
    }, 1000); // Set the delay for the search to be executed after 1 second
  }

  // A timeout reference for searching files asynchronously.
  let fileSearchTimeout = null;

  /**
   * Searches for files based on the provided input value and calls the callback with the results.
   * @param {string} inputValue - The input value to search for.
   * @param {function} callback - The callback function to return the search results.
   */
  function searchFiles(inputValue, callback) {
    // Clear any existing timeout to avoid rapid firing of requests
    clearTimeout(fileSearchTimeout);
  
    // Set a new timeout to perform the search after a delay of 1000ms (1 second)
    fileSearchTimeout = setTimeout(function() {
      let searchString = "";
      if (!state.fileType) {
        // If fileType is not selected, search for components without specifying the fileType
        searchString = `/api/components?statsQuery=true&search=${inputValue}&fileType=All`;
      } else {
        // If fileType is selected, search for components with the specified fileType
        searchString = `/api/components?statsQuery=true&search=${inputValue}&fileType=${state.fileType.value}`;
      }
      
      // Make an HTTP GET request to search for files using the constructed search string
      http.get(searchString).then(function(res) {
        // Extract and transform the file data from the response into a format suitable for the callback
        callback(
          res.components.map(function(comp) {
            return {
              value: comp,          // The file data
              label: comp,          // Display label for the file in the dropdown
            };
          })
        );
      });
    }, 1000); // Set the delay for the search to be executed after 1 second
  }

  return (
    <div className="container-fluid">
      <div className="row dashboard">
        <div className="col">
          <div className="dashboard-control-horizontal">
            <div className="dashboard-label">
              <span className="filter-header">Group By</span>
            </div>
            <Select
              value={state.group}
              options={groupOptions}
              onChange={(option) => {
                updateSearch({ group: option.value });
              }}
            />
          </div>
          <div className="dashboard-control-horizontal">
            <div className="dashboard-label">
              <span className="filter-header">Users</span>
            </div>
            <AsyncSelect
              cacheOptions
              defaultOptions
              loadOptions={searchUsers}
              value={state.userFilter}
              onChange={(opt) => {
                updateSearch({ user: opt.value.name });
              }}
              menuPlacement="auto"
              isClearable
            />
          </div>
          <div className="dashboard-control-horizontal">
            <div className="dashboard-label">
              <span className="filter-header">Organizational Unit</span>
            </div>
            <AsyncSelect
              cacheOptions
              defaultOptions
              loadOptions={searchOU}
              value={state.ouFilter}
              onChange={(opt) => {
                updateSearch({ ou: opt.value });
              }}
              menuPlacement="auto"
              isClearable
            />
          </div>
          <div className="dashboard-control-horizontal">
            <div className="dashboard-label">
              <span className="filter-header">Time Period</span>
            </div>
            <Select
              value={state.timePeriod}
              options={timePeriodOptions}
              onChange={(handleTimePeriodChange)}
            />
            {state.customTimePeriod && (
              <div className="col custom-time">
                <div className="dashboard-label">
                  <span className="filter-header">Custom Time Period</span>
                </div>
                <div className="dashboard-control-horizontal">
                  <div className="dashboard-label">
                    <span className="filter-header">Start Date</span>
                  </div>
                  <div className="col custom-time">
                    <DatePicker
                      selected={state.startDate}
                      startDate={state.startDate}
                      endDate={state.endDate}
                      onChange={(date) => {
                        setState((prevState) => ({
                          ...prevState,
                          startDate: date,
                        }));
                        handleTimePeriodChange({value: 'custom', startDate: date, endDate: state.endDate});
                      }}
                      selectsStart
                      startDatePlaceholderText="Start Date"
                      isClearable
                      className="form-control"
                      onClear={() => {
                        setState((prevState) => ({
                          ...prevState,
                          startDate: null,
                        }));
                        handleTimePeriodChange({value: 'custom', startDate: null, endDate: state.endDate});
                      }}
                    />
                  </div>
                </div>
                <div className="dashboard-control-horizontal">
                  <div className="dashboard-label">
                    <span className="filter-header">End Date</span>
                  </div>
                  <div className="col custom-time">
                    <DatePicker
                      selected={state.endDate}
                      startDate={state.startDate}
                      endDate={state.endDate}
                      onChange={(date) => {
                        setState((prevState) => ({
                          ...prevState,
                          endDate: date,
                        }));
                        handleTimePeriodChange({value: 'custom', startDate: state.startDate, endDate: date});
                      }}
                      selectsEnd
                      endDatePlaceholderText="End Date"
                      isClearable
                      className="form-control"
                      onClear={() => {
                        setState((prevState) => ({
                          ...prevState,
                          endDate: null,
                        }));
                        handleTimePeriodChange({value: 'custom', startDate: state.startDate, endDate: null});
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="dashboard-control-horizontal">
            <button className="component-dl" onClick={getCSV}>
              Download CSV
            </button>
          </div>
        </div>
        <div className="col">
          <div className="container">
            {state.groupByChoice && (
              <div className="row graph-header">
                <div className="dashboard-control col-sm-5">
                  <div className="dashboard-label">
                    <span className="filter-header">Patch Name</span>
                  </div>
                  <AsyncSelect
                    cacheOptions={true}
                    defaultOptions
                    loadOptions={searchFiles}
                    value={state.file}
                    onChange={(opt, action) => {
                      if (action.action === 'clear') {
                        updateSearch({}, ['file']);
                      } else if (opt) {
                        updateSearch({ file: opt.value });                   
                      }
                    }}
                    menuPlacement="auto"
                    isClearable
                  />
                </div>
                <div className="dashboard-control col-sm-3">
                  <div className="dashboard-label">
                    <span className="filter-header">Patch Type</span>
                  </div>
                  <Select
                    value={state.fileType}
                    options={fileTypeOptions}
                    onChange={(option) => {
                      updateSearch({ fileType: option.value });
                    }}
                  />
                </div>
              </div>
            )}
            <ResponsiveContainer aspect={2.3}>
              <BarChart
                data={state.downloads && state.downloads.length > 0
                  ? state.downloads.map((d) => ({
                      downloads: d.count,
                      name: d[state.group?.value || 'category'],
                    }))
                  : []}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="downloads" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
