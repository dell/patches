import React, { useState, useEffect } from "react";
import qs from "qs";
import http, { hasAdminRole } from "../../http";
import Select from "react-select";
import "./style.css";
import { useTable, usePagination } from "react-table";
import BTable from "react-bootstrap/Table";
import Alert from "react-bootstrap/Alert";
import Pagination from "react-bootstrap/Pagination";

export const getRoles = (params, options) => {
  let { search } = params || {};
  return http.get(`/api/roles?search=${search}`, options);
};

let currentCell = null;
let error = null;

function UserTable({ columns, data }) {
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

  const { pageIndex, pageSize } = state;

  const getCellVal = (cell) => {
    currentCell = cell.row.values;
  };

  let pageArray = [];
  let active = pageIndex;

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
  return (
    <div>
      <dlv className="row">
        <div className="col-sm-12">
          {paginationNums()}
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
          <Pagination>{pageArray}</Pagination>
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

function UserEdit() {
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

  function getCSV() {
    window.open(`/api/users/audit`);
    return null;
  }

  const roleOptions = [
    { value: 1, label: "Admin" },
    { value: 2, label: "User" },
  ];

  const [data, setData] = useState([]);

  useEffect(() => {
    return http.get(`/api/users`).then((res) => {
      setData(res.users);
    });
  }, []);

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

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-sm-4">
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
        <UserTable columns={columns} data={data} />
      </div>
      <div className="row">
        <div className="col">
          <button className="component-dl" onClick={getCSV}>
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserEdit;
