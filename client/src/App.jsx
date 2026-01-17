import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClientKeys from './pages/ClientKeys';
import ProviderKeys from './pages/ProviderKeys';
import RequestLogs from './pages/RequestLogs';
import Playground from './pages/Playground';
import UsageReport from './pages/UsageReport';
import Layout from './components/Layout';
import api from './api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const username = localStorage.getItem('username');
        if (token && username) {
            setUser({ username, token });
        }
        setLoading(false);
    }, []);

    const login = (userData) => {
        localStorage.setItem('token', userData.token);
        localStorage.setItem('username', userData.username);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        setUser(null);
    };

    if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-primary">Loading...</div>;

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

const ProtectedRoute = ({ children }) => {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
};

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={
                        <ProtectedRoute>
                            <Layout />
                        </ProtectedRoute>
                    }>
                        <Route index element={<Dashboard />} />
                        <Route path="keys" element={<ClientKeys />} />
                        <Route path="provider-keys" element={<ProviderKeys />} />
                        <Route path="logs" element={<RequestLogs />} />
                        <Route path="playground" element={<Playground />} />
                        <Route path="usage" element={<UsageReport />} />
                    </Route>
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}
