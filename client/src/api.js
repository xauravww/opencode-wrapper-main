import axios from 'axios';

const api = axios.create({
    baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
});

export const v1Api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
});

const addAuthHeader = (config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    } else {
        config.headers.Authorization = `Bearer sk-58ff73b`;
    }
    return config;
};

const handleUnauthorized = (error) => {
    if (error.response && error.response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
    }
    return Promise.reject(error);
};

api.interceptors.request.use(addAuthHeader);
api.interceptors.response.use((response) => response, handleUnauthorized);

v1Api.interceptors.request.use(addAuthHeader);
v1Api.interceptors.response.use((response) => response, handleUnauthorized);

export default api;
