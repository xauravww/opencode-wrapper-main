import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { LayoutDashboard, Key, LogOut, Server, Terminal, FileText, BadgeDollarSign, DollarSign, Menu, X, ChevronRight } from 'lucide-react';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/keys', icon: Key, label: 'Client Keys' },
    { to: '/provider-keys', icon: Server, label: 'Providers' },
    { to: '/logs', icon: FileText, label: 'Request Logs' },
    { to: '/playground', icon: Terminal, label: 'Playground' },
    { to: '/usage', icon: BadgeDollarSign, label: 'Usage' },
    { to: '/pricing', icon: DollarSign, label: 'Pricing' },
];

export default function Layout() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex min-h-screen bg-background text-text">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed lg:sticky top-0 left-0 z-50 h-screen w-[260px]
                bg-surface border-r border-border flex flex-col
                transition-transform duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {/* Logo */}
                <div className="px-5 py-5 flex items-center justify-between border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                            <Terminal size={18} className="text-primary" />
                        </div>
                        <div>
                            <h1 className="font-bold text-[15px] leading-tight tracking-tight">Opencode</h1>
                            <span className="text-[11px] text-textMuted font-medium">Admin Panel</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-1.5 rounded-lg hover:bg-surfaceHover text-textSecondary"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
                    {navItems.map(({ to, icon: Icon, label, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) => `
                                group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150
                                ${isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-textSecondary hover:text-text hover:bg-surfaceHover'
                                }
                            `}
                        >
                            <Icon size={17} />
                            <span className="flex-1">{label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* User section */}
                <div className="p-3 border-t border-border">
                    <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                            {user?.username?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user?.username}</p>
                            <p className="text-[11px] text-textMuted">Administrator</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-error/80 hover:text-error hover:bg-error/5 rounded-xl transition-all"
                    >
                        <LogOut size={15} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile header */}
                <header className="lg:hidden sticky top-0 z-30 bg-surface/80 backdrop-blur-lg border-b border-border px-4 py-3 flex items-center justify-between">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 -ml-2 rounded-xl hover:bg-surfaceHover text-textSecondary"
                    >
                        <Menu size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                        <Terminal size={16} className="text-primary" />
                        <span className="font-bold text-sm">Opencode</span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                        {user?.username?.[0]?.toUpperCase()}
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
