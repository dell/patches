import React from "react";
import { Helmet } from "react-helmet";
import { NavLink, Link, Switch, Route } from "react-router-dom";
import http from "../../http";
import Overview from "./Overview";
import Drivers from "./Drivers";
import Docs from "./Docs";
import cubeImg from "./static/esupport-blank-space-v2.png";
import "./style.css";

class Product extends React.Component {
  state = {
    tab: "OVERVIEW",
    device: {},
  };

  componentDidMount = () => {
    let { match } = this.props;
    http.get(`/api/systems?id=${match.params.device}`).then((res) => {
      if (res.systems.length === 0) return alert("No system with this ID");
      this.setState({ device: res.systems[0] });
    });
  };

  getTab = () => {
    let { pathname } = this.props.location;
    let tab = pathname.substr(pathname.lastIndexOf("/") + 1);
    switch (tab) {
      case "overview":
        return "Overview";
      case "docs":
        return "Documentation";
      default:
        return "Drivers & Downloads";
    }
  };

  render = () => {
    let { match } = this.props;
    let { device } = this.state;
    return (
      <div>
        <Helmet>
          {device.name && (
            <title>
              Support for {device.name} | {this.getTab()} | Dell US
            </title>
          )}
        </Helmet>
        <div className="product-support-hero">
          {device.name && (
            <div className="product-hero-content">
              <div className="product-hero-img">
                <img src={cubeImg} alt="cube" />
              </div>
              <div className="product-info">
                <div className="product-name">{device.name}</div>
                <div style={{ color: "#007db8" }}>
                  {"< "}
                  <Link className="product-change" to="/products">
                    Change product
                  </Link>
                </div>
              </div>
            </div>
          )}
          <div className="product-tab-links">
            {/*<NavLink
              exact
              to={`${match.url}/overview`}
              className="product-tab-link"
              activeClassName="product-tab-link-active"
            >
              OVERVIEW
            </NavLink>*/}
            <NavLink
              exact
              to={`${match.url}/drivers`}
              className="product-tab-link"
              activeClassName="product-tab-link-active"
            >
              DRIVERS & DOWNLOADS
            </NavLink>
            {/*<NavLink
              exact
              to={`${match.url}/docs`}
              className="product-tab-link"
              activeClassName="product-tab-link-active"
            >
              DOCUMENTATION
            </NavLink>*/}
          </div>
        </div>
        <div className="product-tab-content">
          <Switch className="container">
            <Route exact path={`${match.path}/overview`}>
              <Overview />
            </Route>
            <Route exact path={`${match.path}/drivers`}>
              {device.name && <Drivers device={device} />}
            </Route>
            <Route exact path={`${match.path}/docs`}>
              {device.name && <Docs device={device} />}
            </Route>
          </Switch>
        </div>
      </div>
    );
  };
}

export default Product;
