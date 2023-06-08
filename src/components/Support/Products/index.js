import React, { Component } from "react";
import { NavLink, Link, Switch, Route } from "react-router-dom";
import Product from "../Product";
import http from "../../http";
import { strCompare } from "../../util";
import "./style.css";
import Alert from "react-bootstrap/Alert";

class Products extends Component {
  state = {
    loading: false,
    products: [],
    authorized: null,
  };

  componentDidMount = () => {
    let { params } = this.props.match;
    if (
      this.props.location.state !== undefined &&
      this.props.location.state !== null
    ) {
      this.setState({
        authorized: this.props.location.state.authorized,
      });
    }
    if (!params.category) {
      http.get("/api/brands").then((res) => {
        if (res.brands.length === 0) return alert("No products available");
        this.setState({ products: res.brands.sort() });
      });
    } else if (params.category && !params.device) {
      http.get("/api/systems?brand=" + params.category).then((res) => {
        if (res.systems.length === 0)
          return alert("No devices for this product available");
        res.systems.sort((a, b) => strCompare(a.system_id, b.system_id));
        this.setState({
          products: res.systems,
        });
      });
    }
  };

  getBreadCrumbs = () => {
    let { match } = this.props;
    let path = match.url.split("/");
    path.shift();
    let crumbs = [];
    crumbs.push({ label: "All " + path[0], path: `/${path[0]}/` });
    for (let i = 1; i < path.length; i++) {
      if (path[i])
        crumbs.push({
          label: path[i],
          path: `${crumbs[i - 1].path}${path[i]}/`,
        });
    }
    return crumbs;
  };

  render = () => {
    let { match } = this.props;
    let { authorized, products } = this.state;
    return (
      <div className="products-content container">
        <div className="container-fluid">
          <div className="row">
            <div className="col-xs-6">
              {authorized == false && (
                <div className="error-box">
                  <Alert variant="danger">
                    Please contact administrator for access to admin page{" "}
                  </Alert>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="product-nav">
          {this.getBreadCrumbs().map((crumb) => {
            return (
              <div key={crumb.label}>
                <NavLink
                  to={crumb.path}
                  activeClassName="breadcrum-active"
                  exact
                >
                  {crumb.label}
                </NavLink>
                <span className="breadcrumb-delim">/</span>
              </div>
            );
          })}
        </div>
        <div>
          <Switch>
            <Route exact path="/products">
              <div className="product-links row">
                {products.map((prod, i) => (
                  <div key={i} className="component-link col-xs-12 col-md-3">
                    <Link to={`/products/${prod}`}>{prod}</Link>
                  </div>
                ))}
              </div>
            </Route>
            <Route path={"/products/:category"}>
              <div className="product-links row">
                {products.map((prod, i) => {
                  return (
                    <div key={i} className="component-link col-xs-12 col-md-3">
                      <Link to={`${match.url}/${prod.system_id}/drivers`}>
                        {`${prod.brand} ${prod.name}`}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </Route>
            <Route path={"/products/:category/:device"} component={Product} />
          </Switch>
        </div>
      </div>
    );
  };
}

export default Products;
