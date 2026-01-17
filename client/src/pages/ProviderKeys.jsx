import React, { useState, useEffect } from 'react';
import api from '../api';
import { Trash2, Plus, Key, CheckCircle, XCircle } from 'lucide-react';

export default function ProviderKeys() {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);

    const providers = [
        'openai', 'anthropic', 'google', 'mistral', 'groq', 'cerebras', 'together', 'fireworks', 'nvidia', 'deepseek', 'openrouter', 'cohere', 'opencode'
    ];

    const [formData, setFormData] = useState({ provider: 'openai', key: '' });

    const fetchKeys = async () => {
        try {
            const res = await api.get('/admin/provider-keys');
            setKeys(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const handleAddKey = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/provider-keys', { provider_name: formData.provider, api_key: formData.key });
            setFormData({ provider: 'openai', key: '' });
            fetchKeys();
        } catch (error) {
            alert('Error adding key');
        }
    };

    const handleDeleteKey = async (id) => {
        if (!window.confirm('Are you sure? This will stop traffic to this provider key.')) return;
        try {
            await api.delete(`/admin/provider-keys/${id}`);
            fetchKeys();
        } catch (error) {
            alert('Error deleting key');
        }
    };

    const handleToggleStatus = async (id, currentStatus) => {
        try {
            await api.patch(`/admin/provider-keys/${id}/status`, { is_active: !currentStatus });
            fetchKeys();
        } catch (error) {
            alert('Error updating status');
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold">Provider Connections</h2>
                <p className="text-textDim">Manage backend API keys for LLM providers.</p>
            </div>

            {/* Add Key Form */}
            <div className="glass-panel p-6">
                <h3 className="text-lg font-semibold mb-4">Add New Connection</h3>
                <form onSubmit={handleAddKey} className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                        <label className="text-xs uppercase font-bold text-textDim">Provider</label>
                        <select
                            className="input-field"
                            value={formData.provider}
                            onChange={e => setFormData({ ...formData, provider: e.target.value })}
                        >
                            {providers.sort().map(p => (
                                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-[2] space-y-2">
                        <label className="text-xs uppercase font-bold text-textDim">API Key</label>
                        <input
                            type="password"
                            className="input-field"
                            placeholder="sk-..."
                            value={formData.key}
                            onChange={e => setFormData({ ...formData, key: e.target.value })}
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary flex items-center gap-2">
                        <Plus size={18} /> Add Key
                    </button>
                </form>
            </div>

            {/* Keys List */}
            <div className="glass-panel overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-textDim uppercase text-xs">
                        <tr>
                            <th className="p-4 font-medium">Provider</th>
                            <th className="p-4 font-medium">Source</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium">Added At</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {Object.entries(keys.reduce((acc, key) => {
                            if (!acc[key.provider_name]) acc[key.provider_name] = [];
                            acc[key.provider_name].push(key);
                            return acc;
                        }, {})).map(([provider, providerKeys]) => (
                            <React.Fragment key={provider}>
                                {/* Provider Group Header */}
                                <tr className="bg-white/5">
                                    <td colSpan="4" className="p-3">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-lg capitalize">{provider}</span>
                                            <span className="text-xs font-mono bg-white/10 text-textDim px-2 py-0.5 rounded-full border border-white/10">
                                                {providerKeys.length} {providerKeys.length === 1 ? 'Key' : 'Keys'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                {/* Key Rows */}
                                {providerKeys.map(key => (
                                    <tr key={key.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 pl-8 font-medium capitalize flex items-center gap-2">
                                            <div className="w-1 h-8 border-l-2 border-white/10 absolute left-4"></div>
                                            <Key size={14} className="text-primary opacity-50" />
                                            <span className="text-textDim text-sm">Key {key.id.toString().includes('env') ? '#' + (parseInt(key.id.split('-').pop()) + 1) : '(DB)'}</span>
                                        </td>
                                        <td className="p-4">
                                            {key.source === 'env' ? (
                                                <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs font-mono">.ENV</span>
                                            ) : (
                                                <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-xs font-mono">DATABASE</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {key.source === 'env' ? (
                                                <span className="flex items-center gap-1 text-secondary text-xs font-bold uppercase">
                                                    <CheckCircle size={12} /> Active
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handleToggleStatus(key.id, key.is_active)}
                                                    className={`flex items-center gap-1 text-xs font-bold uppercase px-2 py-1 rounded transition-colors ${key.is_active
                                                        ? 'bg-secondary/20 text-secondary hover:bg-secondary/30'
                                                        : 'bg-white/10 text-textDim hover:bg-white/20'
                                                        }`}
                                                >
                                                    {key.is_active ? <><CheckCircle size={12} /> Active</> : <><XCircle size={12} /> Inactive</>}
                                                </button>
                                            )}
                                        </td>
                                        <td className="p-4 text-textDim text-xs font-mono">
                                            {key.created_at ? new Date(key.created_at).toLocaleString() : '-'}
                                        </td>
                                        <td className="p-4 text-right">
                                            {key.source !== 'env' && (
                                                <button
                                                    onClick={() => handleDeleteKey(key.id)}
                                                    className="text-textDim hover:text-error hover:bg-error/10 p-2 rounded transition-colors"
                                                    title="Delete Key"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                        {keys.length === 0 && (
                            <tr>
                                <td colSpan="5" className="p-8 text-center text-textDim">
                                    No dynamic keys found. System is using .env keys only.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
