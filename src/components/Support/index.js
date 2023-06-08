import React, { Component } from "react";
import { Switch, Route } from "react-router-dom";
import { Helmet } from "react-helmet";
import Products from "./Products";
import Product from "./Product";
import Dashboard from "../Admin/Dashboard";
import XmlDetails from "./Products/XmlDetails"
import "./style.css";

class Support extends Component {
  render = () => {
    return (
      <div className="App">
        <Helmet>
          <title>Product Support | Dell US</title>
        </Helmet>
        <Switch>
          <Route
            path={"/products/:category?"}
            component={(props) => {
              return (
                <div className="support-products">
                  <Products {...props} />
                </div>
              );
            }}
            exact
          />
          <Route path="/products/:category/:device" component={Product} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/catalogs" component={XmlDetails} />
        </Switch>
      </div>
    );
  };
}

export default Support;
