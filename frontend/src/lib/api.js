import axios from 'axios';

const ENV_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const API_URL = ENV_URL && ENV_URL.trim() !== '' ? ENV_URL : '/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK') {
      console.error(
        `[Network Error] Backend at ${API_URL} unreachable – is the server running?`
      );
    }
    return Promise.reject(error);
  }
);

export default api;
