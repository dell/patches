const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export const getUser = () => {
  try {
    return JSON.parse(window.localStorage.getItem("user"));
  } catch (error) {
    console.error("Error retrieving user from local storage:", error);
    return null;
  }
};

export const setUser = (user) => {
  try {
    window.localStorage.setItem("user", JSON.stringify(user));
  } catch {
    console.log("Failed to save user");
  }
};

export const hasAdminRole = (user) => {
  try {
    const currentUser = user || getUser(); // Get user data if not provided
    return currentUser.roles["title"] === "admin"; // Check if user has admin role
  } catch {
    return false; // Return false on error or if user doesn't have admin role
  }
};

export default {
  get: (url) => {
    let currHeaders = { ...headers };
    return fetch(`${url}`, {
      headers: currHeaders,
      credentials: "include",
    }).then((response) => {
      switch (response.status) {
        case 403:
          window.location.href = "/404";
          return;
        default:
          return response.json();
      }
    });
  },
  post: (url, data) => {
    let currHeaders = { ...headers };
    return fetch(`${url}`, {
      headers: currHeaders,
      method: "POST",
      credentials: "include",
      body: JSON.stringify(data),
    }).then((response) => {
      switch (response.status) {
        case 403:
          return response;
        default:
          return response.json();
      }
    });
  },
  put: (url, data) => {
    let currHeaders = { ...headers };
    return fetch(`${url}`, {
      headers: currHeaders,
      method: "PUT",
      credentials: "include",
      body: JSON.stringify(data),
    }).then((response) => {
      switch (response.status) {
        case 403:
          return response;
        default:
          return response.json();
      }
    });
  },
  del: (url) => {
    let currHeaders = { ...headers };
    return fetch(`${url}`, {
      headers: currHeaders,
      method: "DELETE",
      credentials: "include",
    }).then((response) => {
      switch (response.status) {
        case 403:
          return response;
        default:
          return response.json();
      }
    });
  },
  image: (url, data, type) => {
    let currHeaders = {
      "Content-Type": type,
    };
    return fetch(`${url}`, {
      headers: currHeaders,
      method: "PUT",
      body: data,
    }).then((response) => response);
  },
};
