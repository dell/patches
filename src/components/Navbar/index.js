import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import http, { getUser, setUser, hasAdminRole } from "../http";
import "./style.css";

function Navbar() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false); // State to manage admin role

  useEffect(() => {
    http
      .get("/api/auth")
      .then((res) => {
        if (res.error) {
          console.error(`Authenticating to the API server failed. Error was: ${res.error}`);
        } else {
          setUser(res.user);
          setIsAdmin(hasAdminRole(res.user)); // Set admin role based on user data
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error(`Authenticating to the API server failed. Error was: ${error}`);
        setLoading(false);
      });
  }, []);

  return (
    <div className="navbar">
      <div className="nav-desktop-menu">
        <div className="container-fluid nav-links">
          <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div className="dell-logo">
              <img src={require("./static/images/dell-logo.png")} alt="Dell Logo" />
            </div>
            <div className="dell-tech">
              <img src={require("./static/images/dell-technologies.png")} alt="Dell Tech" />
            </div>
          </div>
          {loading ? (
            <a className="nav-link products-link">
              <div className="nav-user">Loading username...</div>
            </a>
          ) : user ? (
            <a className="nav-link products-link">
              <div className="nav-user">You are logged in as: {user.name}</div>
            </a>
          ) : (
            <a className="nav-link products-link">
              <div className="nav-user">
                Authentication failed. Please make sure your certificate is valid.
              </div>
            </a>
          )}
          <Link className="nav-link" to="/catalogs">
            Catalog List
          </Link>
          <Link className="nav-link products-link" to="/products">
            Access Driver Systems Here
          </Link>
          {isAdmin && (
            <a
              className="nav-link"
              onClick={() => {
                navigate("/admin/dashboard");
              }}
            >
              Admin Dashboard
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default Navbar;
