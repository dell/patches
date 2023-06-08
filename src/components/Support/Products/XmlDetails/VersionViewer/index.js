import React, { useState, useEffect } from "react";
import qs from "qs";
import Select from "react-select";
import "./style.css";
import { useTable, usePagination } from "react-table";
import BTable from "react-bootstrap/Table";
import Alert from "react-bootstrap/Alert";
import Pagination from "react-bootstrap/Pagination";
import http, { hasAdminRole } from "../../../../http";
import { Formik, Form, Field, ErrorMessage } from "formik";

let currentCell = null;
let error = null;

function XmlTable({ columns, data }) {
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

const XmlTreeComponents = (props) => {
	const [data, setData] = useState([]);
	const [query, setQuery] = useState([]);

	const componentsVersionQuery = (searchQuery) => {
		let qsParams = {};
		qsParams.search = searchQuery;
		qsParams.versionQuery = props.xmlFileName;
		return http.get(`/api/components?${qs.stringify(qsParams)}`).then((res) => {
			setData(res.components);
		});
	}

	function getCSV() {
		let qsParams = {};
		qsParams.search = query;
		qsParams.versionQuery = props.xmlFileName;
		qsParams.csv = true;
		console.log(qs.stringify(qsParams));
		window.open(`/api/components/csv?${qs.stringify(qsParams)}`);
		return null;
	}

	useEffect(() => {
		componentsVersionQuery(null, false);
	}, []);

	const columns = React.useMemo(
			() => [
				{
					Header: "Driver List",
					columns: [
						{
							Header: "Driver Name",
							accessor: "name",
						},
						{
							Header: "Description",
							accessor: "description",
						},
						{
							Header: "Dell Version",
							accessor: "dell_version",
						},
						{
							Header: "Vendor Version",
							accessor: "vendor_version",
						},
						{
							Header: "Release Date",
							accessor: "release_date",
						},
						{
							Header: "Package Type",
							accessor: "package_type",
						}
					]
				}
			],
			[]
	);

	return (
			<div className="container-fluid xml-table">
				<div className="row">
					<div className="col-md-4 col-auto">
						<input className="drivers-input"
						       onChange={(e) => {
						       	componentsVersionQuery(e.target.value);
						       	setQuery(e.target.value);
						       }}
						       placeholder="Enter driver query here"
						/>
					</div>
					<div className="col-md-2">
						<button className="component-dl" onClick={getCSV}>
							Download CSV
						</button>
					</div>
				</div>
				<div className="row">
					<div className="col-sm-4">
						{error == true && (
								<div className="error-box">
									<Alert variant="danger">

									</Alert>
								</div>
						)}
					</div>
				</div>
				<div>
					<XmlTable columns={columns} data={data} />
				</div>
				<div className="row">
					<div className="col">
						{/*<button className="component-dl" onClick={getCSV}>
							Download CSV
						</button>*/}
					</div>
				</div>
			</div>
	);
}

export default XmlTreeComponents;