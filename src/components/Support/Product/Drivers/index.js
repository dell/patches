import React, { useState, useEffect } from "react";
import Select from "react-select";
import http from "../../../http";
import { strCompare } from "../../../util";
import Driver from "./Driver";
import "./style.css";

// Component to handle the drivers
const Drivers = ({ device }) => {
  // State for storing drivers, keyword, category, format, sorting order
  const [state, setState] = useState({
    drivers: [],
    keyword: "",
    category: "",
    format: "",
    sort: "",
    sortAsc: false,
  });

  // Effect hook to fetch drivers from the API
  useEffect(() => {
    http.get(`/api/components?system=${device.system_id}`).then((res) => {
      setState((prevState) => ({ ...prevState, drivers: res.components }));
    });
  }, [device]);

  // Function to extract unique categories from drivers
  const getCategories = () => {
    const categories = [];
    state.drivers.forEach((d) => {
      if (!categories.includes(d.category)) categories.push(d.category);
    });
    return categories.map((c) => ({ label: c, value: c }));
  };

  // Function to determine the arrow class for sorting
  const getArrowClass = (header) => {
    if (state.sort === header) {
      return state.sortAsc ? "table-sort-up" : "table-sort-down";
    }
    return "table-sort-both";
  };

  // Function for sorting logic
  const sortFn = (a, b) => {
    switch (state.sort) {
      case "NAME":
        return (state.sortAsc ? 1 : -1) * strCompare(a.name, b.name);
      case "CATEGORY":
        return (state.sortAsc ? 1 : -1) * strCompare(a.category, b.category);
      case "RELEASE DATE":
        return (
          (state.sortAsc ? 1 : -1) *
          (new Date(a.release_date) - new Date(b.release_date))
        );
      default:
        break;
    }
  };

  // Filtering and sorting drivers
  let drivers = state.drivers.filter((d) => {
    let filter = true;
    if (state.keyword) {
      filter = filter && d.name.toLowerCase().includes(state.keyword.toLowerCase());
    }
    if (state.category) {
      filter = filter && d.category === state.category.value;
    }
    return filter;
  });
  drivers.sort(sortFn);

  // Returning the JSX for rendering
  return (
    <div className="drivers col-xs-10">
      <h3 className="drivers-title">
        <svg className="dti drivers-card-title-icon">
          <svg id="dt-search" viewBox="0 0 32 32" width="100%" height="100%">
            <path d="M30.304 29.005l-9.363-9.365c1.562-1.873 2.505-4.28 2.505-6.904 0-5.956-4.845-10.801-10.801-10.801s-10.803 4.845-10.803 10.801 4.845 10.801 10.801 10.801c2.656 0 5.086-0.968 6.968-2.562l9.361 9.361 1.331-1.331zM12.644 21.655c-4.917 0-8.919-4-8.919-8.919s4.002-8.919 8.919-8.919 8.919 4 8.919 8.919-4.002 8.919-8.919 8.919z"></path>
          </svg>
        </svg>
        Find a driver for your {device.name}
      </h3>
      <div className="drivers-filter row">
        <div className="col-xs-12 col-md-6">
          <label className="drivers-label">Keyword</label>
          <input
            className="drivers-input"
            onChange={(e) => setState({ ...state, keyword: e.target.value })}
            placeholder="Enter a driver name or keyword"
          />
        </div>
        <div className="col-xs-12 col-md-6">
          <label className="drivers-label">Category</label>
          <Select
            className="basic-single"
            isClearable={true}
            onChange={(category) => {
              setState({ ...state, category });
            }}
            options={getCategories()}
          />
        </div>
      </div>
      {drivers.length > 0 ? (
        <table>
          <thead className="components-table-header">
            <tr>
              {["NAME", "CATEGORY", "RELEASE DATE"].map((header) => (
                <th
                  key={header}
                  onClick={() => {
                    setState({ ...state, sort: header, sortAsc: !state.sortAsc });
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexDirection: "row",
                    }}
                  >
                    <div>{header}</div>
                    <div
                      className={"table-sort-arrows " + getArrowClass(header)}
                    ></div>
                  </div>
                </th>
              ))}
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver, i) => (
              <Driver key={i} driver={driver} />
            ))}
          </tbody>
        </table>
      ) : (
        <div
          className="alert alert-primary align-items-center"
          role="alert"
          id="noDriversDiv"
          bis_skin_checked="1"
        >
          <span className="info-icon">
            <svg className="dti drivers-info">
              <svg
                viewBox="0 0 28 28"
                id="dt-filled-alert-info-cir"
                width="100%"
                height="100%"
              >
                <path
                  d="M13.9993 0.666016C6.63935 0.666016 0.666016 6.63935 0.666016 13.9993C0.666016 21.3593 6.63935 27.3327 13.9993 27.3327C21.3593 27.3327 27.3327 21.3593 27.3327 13.9993C27.3327 6.63935 21.3593 0.666016 13.9993 0.666016ZM15.3327 20.666H12.666V12.666H15.3327V20.666ZM15.3327 9.99935H12.666V7.33268H15.3327V9.99935Z"
                  fill="#006BBD"
                ></path>
              </svg>
            </svg>
          </span>
          <span>
            <b>No drivers found.</b> There are no drivers that meet the filter
            criteria you've applied.
          </span>
        </div>
      )}
    </div>
  );
};

export default Drivers;
