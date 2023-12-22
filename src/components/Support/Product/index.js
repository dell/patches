import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import http from "../../http";
import Overview from "./Overview";
import Drivers from "./Drivers";
import Docs from "./Docs";
import cubeImg from "./static/esupport-blank-space-v2.png";
import "./style.css";

function Product({ device }) {
  const location = useLocation();
  const [deviceData, setDeviceData] = useState(null);

  useEffect(() => {
    http.get(`/api/systems?id=${device}`).then((res) => {
      if (res.systems.length === 0) {
        alert("No system with this ID");
      } else {
        setDeviceData(res.systems[0]);
      }
    });
  }, [device]);

  const getTab = () => {
    const tab = location.pathname.substr(location.pathname.lastIndexOf("/") + 1);
    switch (tab) {
      case "overview":
        return "Overview";
      case "docs":
        return "Documentation";
      default:
        return "Drivers & Downloads";
    }
  };

  return (
    <div>
      <Helmet>
        {deviceData?.name && (
          <title>
            Support for {deviceData.name} | {getTab()} | Dell US
          </title>
        )}
      </Helmet>
      <div className="product-support-hero">
        {deviceData?.name && (
          <div className="product-hero-content">
            <div className="product-hero-img">
              <img src={cubeImg} alt="cube" />
            </div>
            <div className="product-info">
              <div className="product-name">{deviceData.name}</div>
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
            DRIVERS & DOWNLOADS
        </div>
      </div>
      <div className="product-tab-content">
        <Routes>
          <Route path="/overview" element={<Overview />} />
          <Route path="/drivers" element={deviceData && <Drivers device={deviceData} />} />
          <Route path="/docs" element={deviceData && <Docs device={deviceData} />} />
        </Routes>
      </div>
    </div>
  );
}

export default Product;
