import React, { useState, useEffect } from "react";
import Select from "react-select";
import "./style.css";
import { useTable, usePagination } from "react-table";
import BTable from "react-bootstrap/Table";
import Alert from "react-bootstrap/Alert";
import Pagination from "react-bootstrap/Pagination";
import http from '../../http';

// Define a function to fetch roles using HTTP
export const getRoles = (params, options) => {
  let { search } = params || {};
  return http.get(`/api/roles?search=${search}`, options);
};

// Initialize global variables
let currentCell = null;
let error = null;

/**
 * This function displays a list of users from the postgresql database and their current roles.
 *
 * @param {Object} props - Component props.
 * @param {Array} columns - Array of column definitions
 * @param {Array} data - Array of user data
 */
function UserTable({ columns, data }) {
  // Destructure functions and state from the react-table library
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    nextPage,
    previousPage,
    canPreviousPage,
    canNextPage,
    pageOptions,
    state,
    gotoPage,
    pageCount,
    setPageSize,
    prepareRow,
  } = useTable(
    {
      columns,
      data,
    },
    usePagination
  );

  // Destructure current page index and page size from state
  const { pageIndex, pageSize } = state;

  // Function to get the cell value when clicked
  const getCellVal = (cell) => {
    currentCell = cell.row.values;
  };

  // Initialize an array for pagination page numbers
  let pageArray = [];
  let active = pageIndex;

  // Function to generate pagination numbers
  function paginationNums() {
    for (let i = 0; i < pageOptions.length; i++) {
      pageArray.push(
        <Pagination.Item
          key={i}
          active={i === active}
          onClick={() => {
            gotoPage(i);
          }}
        >
          {i + 1}
        </Pagination.Item>
      );
    }
  }

  // Render the UserTable component
  return (
    <div>
      <dlv className="row"> {/* Note: <dlv> is not a standard HTML element */}
        <div className="col-sm-12">
          {paginationNums()} {/* Render pagination numbers */}
          <BTable className="striped bordered hover" {...getTableProps()}>
            <thead className="">
              {headerGroups.map((headerGroup) => (
                <tr {...headerGroup.getHeaderGroupProps()}>
                  {headerGroup.headers.map((column) => (
                    <th {...column.getHeaderProps()}>
                      {column.render("Header")}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {page.map((row, i) => {
                prepareRow(row);
                return (
                  <tr {...row.getRowProps()}>
                    {row.cells.map((cell) => {
                      return (
                        <th
                          onClick={() => getCellVal(cell)}
                          {...cell.getCellProps()}
                        >
                          {cell.render("Cell")}
                        </th>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </BTable>
        </div>
      </dlv>
      <div className="row g-0">
        <div className="col-auto pagination-align-left">
          <Pagination>{pageArray}</Pagination> {/* Render pagination */}
        </div>
        <div className="col-auto">
          <span className="pagination-pad-left">
            {" "}
            Go to page:{" "}
            <input
              className="pagination-shrink"
              type="number"
              defaultValue={pageIndex + 1}
              onChange={(e) => {
                const pageNumber = e.target.value
                  ? Number(e.target.value) - 1
                  : 0;
                gotoPage(pageNumber);
              }}
            />
          </span>{" "}
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {[1, 5, 10, 25, 50].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                Show {pageSize}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// UserEdit component for managing user data
function UserEdit() {

  // Use useEffect to fetch user data when the component mounts
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user data using HTTP GET request
        const res = await http.get(`/api/users`);
        setData(res.users);
      } catch (error) {
        console.error(error);
      }
    };
    
    fetchData(); // Call the fetchData function
  }, []); // The empty dependency array ensures this effect runs once on mount

  // Function to change user role
  function changeUserRole(option) {
    return http
      .put(
        `/api/roles/${currentCell.name}/?target_role=${option.value}&target_organizational_unit=${currentCell.organizational_unit}`
      )
      .then((res) => {
        if (!res.roles) error = true;
        return http.get(`/api/users`).then((res) => {
          setData(res.users);
          if (error) error = false;
        });
      });
  }

  /**
   * Opens a new browser window/tab to download a CSV file containing audit data.
   * @returns {null} Returns null as this function is intended for initiating a file download.
   */
  function getCSV() {
    window.open(`/api/users/audit`);
    return null;
  }

  // Define role options for the Select component
  const roleOptions = [
    { value: 1, label: "Admin" },
    { value: 2, label: "User" },
  ];

  // Initialize state for user data
  const [data, setData] = useState([]);

  // Define columns for the user table
  const columns = React.useMemo(
    () => [
      {
        Header: "User Records",
        columns: [
          {
            Header: "User Name",
            accessor: "name",
          },
          {
            Header: "User OU",
            accessor: "organizational_unit",
          },
          {
            Header: "User ORG",
            accessor: "organization",
          },
          {
            Header: "Role",
            accessor: "title",
          },
          {
            Header: "Role Change",
            accessor: "",
            Cell: ({ row }) => {
              return (
                // Render a Select component for role change
                <Select
                  defaultValue={{
                    label: row.original.title,
                    value: row.original.title,
                  }}
                  options={roleOptions}
                  onChange={changeUserRole}
                />
              );
            },
          },
          {
            Header: "User First Login",
            accessor: "created_at",
          },
          {
            Header: "Role Last Updated At",
            accessor: "user_role_last_updated_at",
          },
          {
            Header: "Role Last Updated By",
            accessor: "updating_user",
          },
        ],
      },
    ],
    []
  );

  // Render the UserEdit component
  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-sm-4">
          {/* Display an error message if 'error' is true */}
          {error == true && (
            <div className="error-box">
              <Alert variant="danger">
                You cannot demote yourself from the Administrator role
              </Alert>
            </div>
          )}
        </div>
      </div>
      <div>
        {/* Render the UserTable component with specified columns and data */}
        <UserTable columns={columns} data={data} />
      </div>
      <div className="row">
        <div className="col">
          {/* Button to download CSV data */}
          <button className="component-dl" onClick={getCSV}>
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserEdit;
