import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { LayoutDashboard, Key, LogOut, User, Server, Terminal, FileText, BadgeDollarSign } from 'lucide-react';

export default function Layout() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex min-h-screen bg-background text-text font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-surface border-r border-white/5 flex flex-col">
                <div className="p-6 border-b border-white/5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                        <Terminal size={18} />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-none">Opencode</h1>
                        <span className="text-xs text-textDim">Admin Panel</span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    <NavLink to="/" end className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive ? 'bg-primary/10 text-primary' : 'text-textDim hover:text-text hover:bg-white/5'}`}>
                        <LayoutDashboard size={18} />
                        Dashboard
                    </NavLink>
                    <NavLink to="/keys" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive ? 'bg-primary/10 text-primary' : 'text-textDim hover:text-text hover:bg-white/5'}`}>
                        <Key size={18} /> Client Keys
                    </NavLink>
                    <NavLink to="/provider-keys" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive ? 'bg-primary/10 text-primary' : 'text-textDim hover:text-text hover:bg-white/5'}`}>
                        <Server size={18} /> Provider Keys
                    </NavLink>
                    <NavLink to="/logs" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive ? 'bg-primary/10 text-primary' : 'text-textDim hover:text-text hover:bg-white/5'}`}>
                        <FileText size={18} /> Request Explorer
                    </NavLink>
                    <NavLink to="/playground" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive ? 'bg-primary/10 text-primary' : 'text-textDim hover:text-text hover:bg-white/5'}`}>
                        <Terminal size={18} /> Playground
                    </NavLink>
                    <NavLink to="/usage" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive ? 'bg-primary/10 text-primary' : 'text-textDim hover:text-text hover:bg-white/5'}`}>
                        <BadgeDollarSign size={18} /> Usage Reports
                    </NavLink>
                </nav>

                <div className="p-4 border-t border-white/5">
                    <div className="flex items-center gap-3 px-4 py-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-surfaceHighlight flex items-center justify-center text-sm font-bold">
                            {user?.username?.[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user?.username}</p>
                            <p className="text-xs text-textDim truncate">Admin</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-error hover:bg-error/10 rounded-lg transition-all">
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
