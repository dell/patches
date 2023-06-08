// Import React and logo image into the module
import React from "react";
import logo from "./logo.svg";
import "./App.css";

// Define the functional component called "App"
function App() {
  // Return a JSX element representing the component's output
  return (
    <div className="App">
      <header className="App-header">
        {/* Render the logo image */}
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          {/* Render a paragraph of text */}
          Edit <code>src/App.js</code> and save to reload.
        </p>
        {/* Render a link to the ReactJS website */}
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

// Export the App component as the default export of the module
export default App;

// TODO - this is boilerplate React code. I'm not sure why it is still here, but
// it likely should be removed. https://github.com/orgs/dell/projects/7/views/1?pane=issue&itemId=29635170