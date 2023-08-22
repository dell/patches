function info(message) {
    console.info("INFO:", message);
  }
  
  function warn(message) {
    console.warn("WARNING:", message);
  }
  
  function error(message) {
    console.error("ERROR:", message);
  }

  function debug(message) {
    console.debug("DEBUG:", message);
  }
  
  module.exports = {
    info,
    warn,
    error,
    debug,
  };
  