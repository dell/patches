const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export const getUser = () => {
  try {
    return JSON.parse(window.localStorage.getItem("user"));
  } catch {
    return;
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
    return (user || getUser()).roles["title"] === "admin" ? true : false;
  } catch {
    return false;
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
