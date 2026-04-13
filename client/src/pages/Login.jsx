import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import api from '../api';
import { Terminal, ArrowRight, AlertCircle } from 'lucide-react';

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
        <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/[0.04] rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-secondary/[0.03] rounded-full blur-[120px]" />
                {/* Grid pattern */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'linear-gradient(#E5A84B 1px, transparent 1px), linear-gradient(90deg, #E5A84B 1px, transparent 1px)',
                        backgroundSize: '60px 60px',
                    }}
                />
            </div>

            <div className="w-full max-w-[400px] relative z-10 animate-slide-up">
                {/* Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-5">
                        <Terminal size={26} className="text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
                    <p className="text-textSecondary text-sm mt-1">Sign in to your Opencode dashboard</p>
                </div>

                {/* Form card */}
                <div className="panel-elevated p-6 sm:p-8">
                    {error && (
                        <div className="mb-5 flex items-start gap-2.5 p-3 bg-error/8 border border-error/15 rounded-xl text-sm text-error">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-1.5">
                                Username
                            </label>
                            <input
                                type="text"
                                className="w-full input-field"
                                placeholder="Enter username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoComplete="username"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-1.5">
                                Password
                            </label>
                            <input
                                type="password"
                                className="w-full input-field"
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full btn-primary mt-2 flex items-center justify-center gap-2 py-3"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center mt-6 text-textMuted text-xs">
                    Opencode Wrapper &copy; {new Date().getFullYear()}
                </p>
            </div>
        </div>
    );
}
