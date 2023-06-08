import React from "react";
import Dropzone from "react-dropzone";
import http, { getUser, hasAdminRole } from "../../../http";
import "./style.css";

class Docs extends React.Component {
  state = {
    docs: [],
  };

  componentDidMount() {
    let { device } = this.props;
    http
      .get(`/api/uploads?system=${device.system_id}&download=false`)
      .then((res) => {
        this.setState({ docs: res.uploads });
      });
  }

  getDownload = (id) => {
    http.get(`/api/uploads?id=${id}&download=true`).then((res) => {
      if (res.error) {
        return alert(res.error);
      }
      window.open(res.link);
    });
  };

  onDrop = (acceptedFiles) => {
    let { device } = this.props;
    let path = "https://www.w3.org/TR/PNG/iso_8859-1.txt";
    acceptedFiles.forEach((file) => {
      http
        .post(
          `/api/uploads/add?system=${device.system_id}&name=${file.name}&path=${path}`
        )
        .then((res) => {
          this.setState({ docs: res.uploads });
        });
    });
  };

  render = () => {
    let user = getUser();
    let { docs } = this.state;
    return (
      <div className="product-docs">
        {hasAdminRole(user) && (
          <div className="product-docs-dropzone">
            <Dropzone onDrop={this.onDrop}>
              {({ getRootProps, getInputProps }) => (
                <div {...getRootProps()}>
                  <input {...getInputProps()} />
                  Upload a file
                </div>
              )}
            </Dropzone>
          </div>
        )}
        {docs.length > 0 ? (
          <table>
            <thead className="components-table-header">
              <tr>
                {["NAME", "DOWNLOAD"].map((header) => {
                  return (
                    <th key={header}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          flexDirection: "row",
                          padding: "8px",
                        }}
                      >
                        <div>{header}</div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr>
                  <td className="product-docs-table">{doc.document_name}</td>
                  <td className="product-docs-table">
                    <button
                      className="component-dl"
                      onClick={() => this.getDownload(doc.id)}
                    >
                      Download
                    </button>
                  </td>
                </tr>
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
              <b>No documentation found.</b> There is no documentation for this
              product.
            </span>
          </div>
        )}
      </div>
    );
  };
}

export default Docs;
