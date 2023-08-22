import { Helmet } from "react-helmet";
import { Route, Routes } from "react-router-dom";
import Products from "./Products";
import Product from "./Product";
import Dashboard from "../Admin/Dashboard";
import XmlDetails from "./Products/XmlDetails";
import "./style.css";

function Support() {
  return (
    <div className="App">
      <Helmet>
        <title>Product Support | Dell US</title>
      </Helmet>
      <Routes>
        <Route path="products/*" element={
            <div className="support-products">
              <Products />
            </div>
          }
          exact
        />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="catalogs" element={<XmlDetails />} />
      </Routes>
    </div>
  );
}

export default Support;
