import axios from 'axios';

const ENV_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
const API_URL = ENV_URL && ENV_URL.trim() !== '' ? ENV_URL : '/api';

axios.defaults.baseURL = API_URL;
axios.defaults.timeout = 15000;
axios.defaults.headers.post['Content-Type'] = 'application/json';
