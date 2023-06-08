import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router, Route } from "react-router-dom";
import "./index.css";
import Navbar from "./components/Navbar";
import Support from "./components/Support";
import Products from "./components/Support/Products"
import Error404 from "./components/Error404";
import Admin from "./components/Admin";
import Footer from "./components/Footer";
import * as serviceWorker from "./serviceWorker";
import "flexboxgrid/css/flexboxgrid.min.css";

ReactDOM.render(
  <Router>
    <div className="index">
      <Navbar />
      <div className="content">
        <Route path="/" component={Support} />
        <Route path="/404" component={Error404} />
        <Route path="/admin" component={Admin} />
      </div>
      <Footer />
    </div>
  </Router>,
  document.getElementById("root")
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
