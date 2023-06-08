import React from "react";
import qs from "qs";
import http, { hasAdminRole } from "../../http";
import Select from "react-select";
import "./style.css";

export const getRoles = (params, options) => {
  let { search } = params || {};
  return http.get(`/api/roles?search=${search}`, options);
};

const roleOptions = [
  { value: 1, label: "Admin" },
  { value: 2, label: "General User" },
];

class UserEditMain extends React.Component {
  state = {
    users: [],
    isAdmin: false,
    userSearch: "",
  };

  componentDidMount = () => {
    getRoles().then((res) => {
      this.setState({ roles: res.roles });
    });
  };

  componentWillUnmount = () => this.abortController.abort();
  abortController = new window.AbortController();

  getUser = () => {
    let { userSearch } = this.state;
    let qsParams = {
      search: userSearch,
    };
    return http.get(`/api/users?${qs.stringify(qsParams)}`).then((res) => {
      if (res.users) {
        this.setState({ users: res.users });
      }
    });
  };

  isAdmin = (user) => {
    return http.get(`/api/roles/${user.name}`).then((res) => {
      if (res.error) return alert(res.error);
      if (res.roles.length > 0 && res.roles[0].title === "admin") {
        this.setState({ isAdmin: true });
      } else {
        this.setState({ isAdmin: false });
      }
    });
  };

  changeRole = (user, role) => {
    if (role === 1) {
      http.put(`/api/roles/${user.name}?role=${role}`).then((res) => {
        if (res.error) return alert(res.error);
      });
    } else {
      http.del(`api/roles/${user.name}`).then((res) => {
        if (res.error) return alert(res.error);
      });
    }
  };

  render = () => {
    let { users, userSearch, isAdmin } = this.state;

    return (
      <div className="container-fluid">
        <div className="row">
          <div className="col-xl-8">
            {users.map((user) => {
              let userRole = isAdmin ? "Admin" : "General User";
              return (
                <div>
                  <table className="user-edit-table">
                    <tr className="user-edit-table-row">
                      <th className="user-edit-table-header">Name</th>
                      <th className="user-edit-table-header">Role</th>
                    </tr>
                    <tr className="user-edit-table-row">
                      <td className="user-edit-table-data">{user.name}</td>
                      <td className="user-edit-table-data">
                        <Select
                          className="user-role-select"
                          placeholder={userRole}
                          options={roleOptions}
                          value={roleOptions.value}
                          onChange={(role) => {
                            this.changeRole(user, role.value);
                          }}
                          menuPlacement="auto"
                        />
                      </td>
                    </tr>
                  </table>
                </div>
              );
            })}
          </div>
          <div className="col-xl-4">
            <div className="user-edit-header">Search for Users</div>
            <form
              className="user-edit-search"
              onSubmit={(e) => {
                e.preventDefault();
                this.getUser();
              }}
            >
              <input
                className="user-input"
                value={userSearch}
                onChange={(e) => {
                  this.setState({ userSearch: e.target.value });
                }}
                placeholder="Search..."
              />
              <button className="user-search-btn">Search</button>
            </form>
          </div>
        </div>
      </div>
    );
  };
}

export default UserEditMain;
