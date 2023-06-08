import React from "react";
import moment from "moment";
import http from "../../../http";

const bytesToSize = (bytes) => {
  var sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 Byte";
  var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
};

class Drivers extends React.Component {
  state = {
    open: false,
  };

  getDownload = () => {
    let { driver } = this.props;
    window.open(`/api/download?component=${driver.id}`);
  };

  render = () => {
    let { driver } = this.props;
    let { open } = this.state;

    let row = [
      <tr
        className="component-info"
        style={{ background: open ? "#f4f4f4" : "" }}
        key={driver.name}
      >
        <td onClick={() => this.setState({ open: !open })}>{driver.name}</td>
        <td onClick={() => this.setState({ open: !open })}>
          {driver.category}
        </td>
        <td onClick={() => this.setState({ open: !open })}>
          {moment(driver.release_date).format("MMM DD, YYYY")}
        </td>
        <td>
          <button className="component-dl" onClick={this.getDownload}>
            Download
          </button>
        </td>
        <td>
          <button
            onClick={() => this.setState({ open: !open })}
            className="component-toggle"
          >
            <svg
              className="dti"
              style={{ transform: open ? "rotate(0deg)" : "rotate(180deg)" }}
            >
              <svg className="dt-chevron-up" viewBox="0 0 32 32">
                <path d="M16 7.962l-14.078 14.078 1.333 1.331 12.745-12.745 12.745 12.745 1.333-1.331z"></path>
              </svg>
            </svg>
          </button>
        </td>
      </tr>,
    ];

    if (open) {
      row.push(
        <tr key={driver.path}>
          <td colSpan={5} className="component-more">
            <div>
              <b>Version: </b>
              {driver.vendor_version}
              {/* <a>Older versions</a> */}
            </div>
            <div>
              <b>Last Updated Date: </b>
              {driver.release_date}
            </div>
            <br />
            <div>
              <b>File Name: </b>
              {driver.path.substr(driver.path.lastIndexOf("/") + 1)}{" "}
              {/* <a>Other formats</a> */}
            </div>
            <div>
              <b>File size: </b> {bytesToSize(driver.size)}
            </div>
            <br />
            <div>
              <b>Description: </b>
              {driver.description}
            </div>
            <br />
            {/* <a>View full driver details</a> */}
          </td>
        </tr>
      );
    }

    return row;
  };
}

export default Drivers;
