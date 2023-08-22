import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import Dashboard from "./Dashboard";
import UserEdit from "./UserEdit";
import { NavLink, useLocation, useNavigate, Outlet } from "react-router-dom";
import http from "../http";
import { hasAdminRole } from "../http";
import "./style.css";
import "bootstrap/dist/css/bootstrap.min.css";

function Admin() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    redirectUnauthorized();
  }, []);

  const redirectUnauthorized = () => {
    http.get("/api/auth").then((res) => {
      if (!hasAdminRole(res.user)) {
        navigate("/products", { state: { authorized: false } });
      }
    });
  };

  return (
    <div>
      <Helmet>
        <title>Admin Support | Dell US</title>
      </Helmet>
      <div className="admin-tab-links">
        <NavLink
          to="users"
          className="admin-tab-link"
        >
          Users
        </NavLink>
        <NavLink
          to="dashboard"
          className="admin-tab-link"
        >
          Dashboard
        </NavLink>
      </div>
      <div className="admin-tab-content">
        <Outlet />
      </div>
    </div>
  );
}

export default Admin;
