import React from "react";
import qs from "qs";
import Select from "react-select";
import AsyncSelect from "react-select/async";
import "moment-timezone";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
} from "recharts";
import http from "../../http";
import "./style.css";

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

class Dashboard extends React.Component {
  state = {
    group: groupOptions[0],
    groupByChoice: null,
    fileType: fileTypeOptions[0],
    downloads: [],
    userFilter: "",
    ouFilter: "",
    file: "",
    timePeriod: timePeriodOptions[3],
    customTimePeriod: null,
    csv: null,
    startDate: null,
    endDate: null,
  };

  componentDidMount = () => {
    let { location } = this.props;
    let params = qs.parse(location.search.substring(1));
    let newState = {};
    if (params.group) {
      newState.group = groupOptions.find((g) => g.value === params.group);
    }
    if (params.user) {
      newState.userFilter = {
        label: params.user,
        value: { name: params.user },
      };
    }
    if (params.ou) {
      newState.ouFilter = { label: params.ou, value: params.ou };
    }
    if (params.timePeriod) {
      newState.timePeriod = timePeriodOptions.find(
        (t) => t.value === params.timePeriod
      );
    }
    this.setState(newState, this.getDownloadCount);
  };

  updateSearch = (newParams) => {
    let { location, history } = this.props;
    let params = qs.parse(location.search.substring(1));
    history.push({
      pathname: "",
      search: qs.stringify({
        ...params,
        ...newParams,
      }),
    });
  };

  cleanCustomTimeSearch = (newParams) => {
    let { location, history } = this.props;
    let params = qs.parse(location.search.substring(1));
    delete params.timePeriod;
    delete params.startDate;
    delete params.endDate;
    history.push({
      ...location,
      search: qs.stringify({
        ...params,
      }),
    });
    history.push({
      pathname: "",
      search: qs.stringify({
        ...params,
        ...newParams,
      }),
    });
  };

  getDownloadCount = () => {
    let {
      group,
      userFilter,
      ouFilter,
      timePeriod,
      startDate,
      endDate,
      fileType,
      file,
      csv,
    } = this.state;
    let qsParams = {};
    if (group) {
      qsParams.group = group.value;
    }
    if (userFilter) {
      qsParams.user = userFilter.value.name;
    }
    if (ouFilter) {
      qsParams.ou = ouFilter.value;
    }
    if (timePeriod) {
      qsParams.tp = timePeriod.value;
      if (timePeriod.value === "custom" && startDate && endDate) {
        qsParams.start = startDate.format();
        qsParams.end = endDate.format();
      }
    }
    if (fileType) {
      qsParams.fileType = fileType.value;
    }
    if (file) {
      qsParams.file = file.value;
    }

    if (csv) {
      qsParams.csv = csv;
      this.setState({ csv: false });
      window.open(`/api/downloads/count?${qs.stringify(qsParams)}`);
      return null;
    }

    return http
      .get(`/api/downloads/count?${qs.stringify(qsParams)}`)
      .then((res) => {
        if (res.downloads) this.setState({ downloads: res.downloads });
      });
  };

  handleGroupChange = (option) => {
    if (option.value === "category") {
      this.setState({ groupByChoice: null });
      this.updateSearch({ group: option.value });
      this.setState({ group: option }, this.getDownloadCount);
    } else {
      this.setState({ groupByChoice: true });
      this.updateSearch({ group: option.value });
      this.setState({ group: option }, this.getDownloadCount);
    }
  };

  handleTimePeriodChange = (option) => {
    let { startDate, endDate } = this.state;
    if (option.value === "custom") {
      this.setState({ customTimePeriod: true });
      this.setState({ timePeriod: option });
    } else {
      this.setState({ customTimePeriod: null });
      this.cleanCustomTimeSearch({ timePeriod: option.value });
      this.setState({ timePeriod: option }, this.getDownloadCount);
    }
  };

  handleCustomTimePeriod = () => {
    let { startDate, endDate } = this.state;
    if (startDate && endDate) {
      this.updateSearch({
        timePeriod: "custom",
        startDate: startDate.format(),
        endDate: endDate.format(),
      });
      this.getDownloadCount();
    }
  };

  handleFileTypeChange = (option) => {
    this.updateSearch({ fileType: option.value });
    this.setState({ fileType: option }, this.getDownloadCount);
  };

  getCSV = () => {
    this.setState({ csv: true }, this.getDownloadCount);
  };

  searchTimeout;
  searchUsers = (inputValue, callback) => {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      return http.get(`/api/users?search=${inputValue}`).then((res) => {
        callback(
          res.users.map((user) => ({
            value: user,
            label: user.name,
          }))
        );
      });
    }, 1000);
  };

  ouTimeout;
  searchOU = (inputValue, callback) => {
    clearTimeout(this.ouTimeout);
    this.ouTimeout = setTimeout(() => {
      return http
        .get(`/api/organizational_units?search=${inputValue}`)
        .then((res) => {
          callback(
            res.organizational_units.map((org) => ({
              value: org,
              label: org,
            }))
          );
        });
    }, 1000);
  };

  fileSearchTimeout;
  searchFiles = (inputValue, callback) => {
    clearTimeout(this.fileSearchTimeout);
    this.fileSearchTimeout = setTimeout(() => {
      let searchString = "";
      if (!this.state.fileType) {
        searchString = `/api/components?statsQuery=true&search=${inputValue}`;
      } else {
        searchString = `/api/components?statsQuery=true&search=
          ${inputValue}&fileType=${this.state.fileType.value}`;
      }
      return http.get(searchString).then((res) => {
        callback(
          res.components.map((comp) => ({
            value: comp,
            label: comp,
          }))
        );
      });
    });
  };

  render = () => {
    let { group, downloads, userFilter, ouFilter, timePeriod, fileType, file } =
      this.state;

    return (
      <div className="container-fluid">
        <div className="row dashboard">
          <div className="col">
            <div className="dashboard-control-horizontal">
              <div className="dashboard-label">
                <span className="filter-header">Group By</span>
              </div>
              <Select
                value={group}
                options={groupOptions}
                onChange={this.handleGroupChange}
              />
            </div>
            <div className="dashboard-control-horizontal">
              <div className="dashboard-label">
                <span className="filter-header">Users</span>
              </div>
              <AsyncSelect
                cacheOptions
                defaultOptions
                loadOptions={this.searchUsers}
                value={userFilter}
                onChange={(opt) => {
                  if (opt) this.updateSearch({ user: opt.value.name });
                  this.setState({ userFilter: opt }, this.getDownloadCount);
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
                loadOptions={this.searchOU}
                value={ouFilter}
                onChange={(opt) => {
                  if (opt) this.updateSearch({ ou: opt.value });
                  this.setState({ ouFilter: opt }, this.getDownloadCount);
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
                value={timePeriod}
                options={timePeriodOptions}
                onChange={this.handleTimePeriodChange}
              />
              {this.state.customTimePeriod && (
                <div className="col custom-time">
                  <div className="dashboard-label">
                    <span className="filter-header">Custom Time Period</span>
                  </div>
                  <div className="dashboard-control-horizontal">
                    <div className="dashboard-label">
                      <span className="filter-header">Custom Time Period</span>
                    </div>
                    <div className="col custom-time">
                      <DatePicker
                        selected={this.state.startDate}
                        startDate={this.state.startDate}
                        endDate={this.state.endDate}
                        onChange={(date) => this.setState({ startDate: date })}
                        selectsStart
                        startDatePlaceholderText="Start Date"
                        isClearable
                        className="form-control"
                      />
                      <DatePicker
                        selected={this.state.endDate}
                        startDate={this.state.startDate}
                        endDate={this.state.endDate}
                        onChange={(date) => this.setState({ endDate: date })}
                        selectsEnd
                        endDatePlaceholderText="End Date"
                        isClearable
                        className="form-control"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="dashboard-control-horizontal">
              <button className="component-dl" onClick={this.getCSV}>
                Download CSV
              </button>
            </div>
          </div>
          <div className="col">
            <div className="container">
              {this.state.groupByChoice && (
                <div className="row graph-header">
                  <div className="dashboard-control col-sm-5">
                    <div className="dashboard-label">
                      <span className="filter-header">File Name</span>
                    </div>
                    <AsyncSelect
                      key={JSON.stringify(fileType.value)}
                      cacheOptions={null}
                      defaultOptions
                      loadOptions={this.searchFiles}
                      value={file}
                      onChange={(opt) => {
                        if (opt) this.updateSearch({ file: opt.value });
                        this.setState({ file: opt }, this.getDownloadCount);
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
                      value={fileType}
                      options={fileTypeOptions}
                      onChange={this.handleFileTypeChange}
                    />
                  </div>
                </div>
              )}

              <ResponsiveContainer aspect={2.3}>
                <BarChart
                  data={downloads.map((d) => ({
                    downloads: d.count,
                    name: d[group.value],
                  }))}
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
}

export default Dashboard;
