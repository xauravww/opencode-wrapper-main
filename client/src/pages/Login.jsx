import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import api from '../api';
import { Terminal, Lock } from 'lucide-react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await api.post('/auth/login', { username, password });
            login(res.data);
            navigate('/');
        } catch (err) {
            setError(err.response?.data || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Accents */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[128px] pointer-events-none" />

            <div className="w-full max-w-md glass-panel p-8 relative z-10">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary mx-auto mb-4">
                        <Terminal size={24} />
                    </div>
                    <h2 className="text-2xl font-bold">Welcome Back</h2>
                    <p className="text-textDim text-sm">Sign in to Opencode Admin</p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-error/10 border border-error/20 text-error rounded-lg text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-textDim mb-1 uppercase tracking-wider">Username</label>
                        <input
                            type="text"
                            className="w-full input-field"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-textDim mb-1 uppercase tracking-wider">Password</label>
                        <input
                            type="password"
                            className="w-full input-field"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full btn-primary mt-4 flex items-center justify-center gap-2"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <Lock size={16} />
                                Sign In
                            </>
                        )}
                    </button>
                </form>
            </div>

            <p className="mt-8 text-textDim text-xs">
                Opencode Wrapper Admin &copy; 2026
            </p>
        </div>
    );
}
