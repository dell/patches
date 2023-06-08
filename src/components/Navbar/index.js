import React, { Component } from "react";
import { Link } from "react-router-dom";
import { withRouter } from "react-router";
import http, { getUser, setUser, hasAdminRole } from "../http";
import "./style.css";

class Navbar extends Component {
  componentDidMount = () => {
    http.get("/api/auth").then((res) => {
      if (res.error) {
        console.error(`Authenticating to the API server failed. Error was: ${res.error}`);
      } else {
        setUser(res.user);
      }
    }).catch(error => {
      console.error(`Authenticating to the API server failed. Error was: ${error}`);
    });
  };

  render = () => {
    let user = getUser();
    let { history } = this.props;

    return (
      <div className="navbar">
        {/*<div className="navbar-top-container container">
          <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div className="dell-logo">
              <img
                src={require("./static/images/dell-logo.png")}
                alt="Dell Logo"
              />
            </div>
            <div className="dell-tech">
              <img
                src={require("./static/images/dell-technologies.png")}
                alt="Dell Tech"
              />
            </div>
            <div className="search-bar col-lg-7 col-md-6 col-sm-6 hidden-xs">
              <Formik
                initialValues={{
                  searchStr: "",
                }}
                validate={(values) => {
                  let errors = {};
                  return errors;
                }}
              >
                {({ values, setFieldValue }) => (
                  <Form>
                    <div className="search-row">
                      <div className="search-input-container">
                        <Field
                          name="searchStr"
                          placeholder="What can we help you find today?"
                          className="search-input"
                        />
                        <ErrorMessage name="searchStr" component="div" />
                      </div>
                      <button className="search-button">Search</button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
          {user && <div className="nav-user">Hi, {user.name}</div>}
        </div>*/}
        <div className="nav-desktop-menu ">
          <div className="container-fluid nav-links">
            <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div className="dell-logo">
                <img
                    src={require("./static/images/dell-logo.png")}
                    alt="Dell Logo"
                />
              </div>
              <div className="dell-tech">
                <img
                    src={require("./static/images/dell-technologies.png")}
                    alt="Dell Tech"
                />
              </div>
              {/*<div className="search-bar col-lg-7 col-md-6 col-sm-6 hidden-xs">
              <Formik
                initialValues={{
                  searchStr: "",
                }}
                validate={(values) => {
                  let errors = {};
                  return errors;
                }}
              >
                {({ values, setFieldValue }) => (
                  <Form>
                    <div className="search-row">
                      <div className="search-input-container">
                        <Field
                          name="searchStr"
                          placeholder="What can we help you find today?"
                          className="search-input"
                        />
                        <ErrorMessage name="searchStr" component="div" />
                      </div>
                      <button className="search-button">Search</button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>*/}
            </div>
            <a className="nav-link products-link">
              {user && (
                <div className="nav-user">
                  You are logged in as: {user.name}
                </div>
              )}
            </a>
            <Link className="nav-link" to="/catalogs">
              Catalog List
            </Link>
            <Link className="nav-link products-link" to="/products">
              Access Driver Systems Here
            </Link>
            {hasAdminRole(user) && (
              <a
                className="nav-link"
                onClick={() => {
                  history.push("/admin/dashboard");
                }}
              >
                Admin Dashboard
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };
}

export default withRouter(Navbar);
