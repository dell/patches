import React from "react";
import Helmet from "react-helmet";
import Dashboard from "./Dashboard";
import UserEdit from "./UserEdit";
import { NavLink, Switch, Route } from "react-router-dom";
import http from "../http";
import { getUser, setUser, hasAdminRole } from "../http";
import "./style.css";
import "bootstrap/dist/css/bootstrap.min.css";

class Admin extends React.Component {
  redirectUnauthorized = () => {
    http.get("/api/auth").then((res) => {
      if (!hasAdminRole(res.user)) {
        this.props.history.push({
          pathname: "/products",
          state: {
            authorized: false,
          },
        });
      }
    });
  };

  componentDidMount = () => {
    this.redirectUnauthorized();
  };

  componentDidUpdate = () => {
    this.redirectUnauthorized();
  };
  render = () => {
    let { match, location, history } = this.props;
    return (
      <div>
        <Helmet>
          <title>Admin Support | Dell US</title>
        </Helmet>
        <div className="admin-tab-links">
          <NavLink
            exact
            to={`${match.url}/users`}
            className="admin-tab-link"
            activeClassName="admin-tab-link-active"
          >
            Users
          </NavLink>
          <NavLink
            exact
            to={`${match.url}/dashboard`}
            className="admin-tab-link"
            activeClassName="admin-tab-link-active"
          >
            Dashboard
          </NavLink>
        </div>
        <div className="admin-tab-content">
          <Switch className="container">
            <Route exact path={`${match.path}/users`}>
              <UserEdit />
            </Route>
            <Route exact path={`${match.path}/dashboard`}>
              <Dashboard location={location} history={history} />
            </Route>
          </Switch>
        </div>
      </div>
    );
  };
}

export default Admin;
