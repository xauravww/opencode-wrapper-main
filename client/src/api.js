import axios from 'axios';

const api = axios.create({
    baseURL: (import.meta.env.VITE_API_URL || ''),
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    } else {
        // Default API key for playground (use one of the existing keys)
        config.headers.Authorization = `Bearer sk-58ff73b`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
