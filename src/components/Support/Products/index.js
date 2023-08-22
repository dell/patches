import React, { useState, useEffect } from "react";
import { NavLink, Link, Route, Routes, useParams, useLocation } from "react-router-dom";
import Product from "../Product";
import http from "../../http";
import { strCompare } from "../../util";
import "./style.css";
import Alert from "react-bootstrap/Alert";

function Products() {
  // Here, 'ProductLine' might be something like "PowerEdge" or "VxRail", 
  // and 'server' could be something like "R440".
  // For more on how this works, see this saint's answer on SO: https://stackoverflow.com/a/76938113/4427375
  const { "*": splat } = useParams();
  const [productLine, server] = splat.split("/"); // <- Example values for productLine and server
  const location = useLocation();
  const [productLines, setProductLines] = useState([]);
  const [servers, setServers] = useState([]);
  const [authorized, setAuthorized] = useState(null);

  useEffect(() => {


    if (location.state !== undefined && location.state !== null) {
      setAuthorized(location.state.authorized);
    }

    const fetchProducts = async () => {
      if (!productLine) {
        try {
          const res = await http.get("/api/brands");
          if (res.brands.length === 0) {
            alert("No product lines available");
          } else {
            setProductLines(res.brands.sort());
          }
        } catch (error) {
          console.error("Failed to fetch product lines:", error);
        }
      // If there's a productLine (e.g., "PowerEdge") but no specific server (e.g., "R440"),
      // fetch the systems for that productLine.
      } else if (productLine && !server) {
        // The endpoint will include the productLine value (e.g., "/api/systems?brand=PowerEdge").
        try {
          const res = await http.get("/api/systems?brand=" + productLine);
          if (res.systems.length === 0) {
            alert("No servers for this product available");
          } else {
            res.systems.sort((a, b) => strCompare(a.system_id, b.system_id));
            setServers(res.systems);
          }
        } catch (error) {
          console.error("Failed to fetch servers:", error);
        }
      }
    };

    fetchProducts();
  }, [productLine, server, location.state]);

  const getBreadCrumbs = () => {
    let path = location.pathname.split("/").filter(Boolean);
    let crumbs = [];
    crumbs.push({ label: "All " + path[0], path: `/${path[0]}/` });
    for (let i = 1; i < path.length; i++) {
      if (path[i]) {
        crumbs.push({
          label: path[i],
          path: `${crumbs[i - 1].path}${path[i]}/`,
        });
      }
    }
    return crumbs;
  };

  return (
    <div className="products-content container">
      <div className="container-fluid">
        <div className="row">
          <div className="col-xs-6">
            {authorized === false && (
              <div className="error-box">
                <Alert variant="danger">
                  Please contact administrator for access to admin page
                </Alert>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="product-nav">
        {getBreadCrumbs().map((crumb) => {
          return (
            <div key={crumb.label}>
              <NavLink to={crumb.path} className="breadcrumb-active" end>
                {crumb.label}
              </NavLink>
              <span className="breadcrumb-delim">/</span>
            </div>
          );
        })}
      </div>
      <div>
        <Routes>
          <Route path="/" element={<ListProductLines productLines={productLines} />} />
          <Route path=":productLine" element={<ListServers servers={servers} />} />
          <Route path=":productLine/:server/*" element={<Product device={server} />} />
        </Routes>
      </div>
    </div>
  );
}

// Component to render a list of product lines PowerEdge, VxRail, etc
function ListProductLines({ productLines }) {
  return (
    <div className="product-links row">
      {/* Map over the 'productLines' array and render each product */}
      {productLines.map((prod, i) => (
        <div key={i} className="component-link col-xs-12 col-md-3">
          {/* Create a link to the product page using 'renderProductName' to form the URL */}
          <Link to={`/products/${prod}`}>
            {/* Display the product name using 'renderProductName' */}
            {prod}
          </Link>
        </div>
      ))}
    </div>
  );
}

// Function to render a list of products for a specific productLine, e.g., servers R440, R7625, etc.
function ListServers({ servers }) {
  return (
    <div className="product-links row">
      {servers.map((prod, i) => {
        return (
          <div key={i} className="component-link col-xs-12 col-md-3">
            <Link to={`./${prod.system_id}/drivers`}>
              {`${prod.brand} ${prod.name}`}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

export default Products;
