import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { createRoot } from "react-dom/client";
import "./index.css";
import Navbar from "./components/Navbar";
import Support from "./components/Support";
import Error404 from "./components/Error404";
import Admin from "./components/Admin";
import Footer from "./components/Footer";
import * as serviceWorker from "./serviceWorker";
import "flexboxgrid/css/flexboxgrid.min.css";
import Dashboard from "./components/Admin/Dashboard";
import UserEdit from "./components/Admin/UserEdit";

function App() {
  return (
    <BrowserRouter>
      <div className="index">
        <Navbar />
        <div className="content">
          <Routes>
            <Route path="*" element={<Support />} />
            <Route path="404" element={<Error404 />} />
            <Route path="/admin/*" element={<Admin />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="users" element={<UserEdit />} />
            </Route>
          </Routes>
        </div>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")).render(<App />);

serviceWorker.unregister();
