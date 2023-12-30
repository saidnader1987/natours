/* eslint-disable */

// dissable eslint because we have it configured with node js code not javascript code, so that it doesnt give us an error
import axios from 'axios';
import { showAlert, hideAlert } from './alert';

export const login = async (email, password) => {
  try {
    // axios will throw an error if the server responds with 400 or 500
    const res = await axios({
      // now axios is an export from the axios module, not an object exposed to the global object
      method: 'POST',
      url: '/api/v1/users/login', // it will try to fetch it from the same server that served the page
      data: { email, password }
    });
    if (res.data.status === 'success') {
      showAlert('success', 'Logged in successfully');
      window.setTimeout(() => {
        location.assign('/');
      }, 1500);
    }
  } catch (err) {
    showAlert('error', err.response.data.message); // this err.response.data is from axios documentation
  }
};

export const logout = async () => {
  try {
    const res = await axios({
      method: 'GET',
      url: '/api/v1/users/logout'
    });
    console.log(res);
    if (res.data.status === 'success') {
      location.reload(true); // force reload from server and not from browser cache. We need to reload because the server needs to send us a new page as a logged out user
    }
  } catch (err) {
    showAlert('error', 'Error loggint out. Try again');
  }
};
