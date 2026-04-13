import React, { useState, useEffect } from 'react';
import api from '../api';
import { Trash2, Plus, Key, CheckCircle, XCircle } from 'lucide-react';
import Select from '../components/Select';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';

const providerList = [
    'openai', 'anthropic', 'google', 'mistral', 'groq', 'cerebras',
    'together', 'fireworks', 'nvidia', 'deepseek', 'openrouter', 'cohere', 'opencode'
];

const providerOptions = providerList.sort().map(p => ({
    value: p,
    label: p.charAt(0).toUpperCase() + p.slice(1)
}));

export default function ProviderKeys() {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ provider: 'openai', key: '' });
    const [toast, setToast] = useState({ message: '', type: 'success' });
    const [confirmState, setConfirmState] = useState({ open: false, id: null });

    const fetchKeys = async () => {
        try {
            const res = await api.get('/admin/provider-keys');
            setKeys(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchKeys(); }, []);

    const handleAddKey = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/provider-keys', { provider_name: formData.provider, api_key: formData.key });
            setFormData({ provider: 'openai', key: '' });
            setShowForm(false);
            fetchKeys();
        } catch (error) {
            setToast({ message: 'Failed to add key', type: 'error' });
        }
    };

    const requestDelete = (id) => {
        setConfirmState({ open: true, id });
    };

    const handleDeleteKey = async () => {
        const id = confirmState.id;
        setConfirmState({ open: false, id: null });
        try {
            await api.delete(`/admin/provider-keys/${id}`);
            fetchKeys();
        } catch (error) {
            setToast({ message: 'Failed to delete key', type: 'error' });
        }
    };

    const handleToggleStatus = async (id, currentStatus) => {
        try {
            await api.patch(`/admin/provider-keys/${id}/status`, { is_active: !currentStatus });
            fetchKeys();
        } catch (error) {
            setToast({ message: 'Failed to update status', type: 'error' });
        }
    };

    const grouped = keys.reduce((acc, key) => {
        if (!acc[key.provider_name]) acc[key.provider_name] = [];
        acc[key.provider_name].push(key);
        return acc;
    }, {});

    return (
        <div className="max-w-5xl space-y-6">
            <ConfirmDialog
                open={confirmState.open}
                title="Delete provider key"
                message="Traffic will stop routing to this key. This cannot be undone."
                confirmLabel="Delete"
                onConfirm={handleDeleteKey}
                onCancel={() => setConfirmState({ open: false, id: null })}
            />
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="page-title">Provider Connections</h2>
                    <p className="page-subtitle">Manage backend API keys for LLM providers.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="btn-primary flex items-center gap-2 shrink-0"
                >
                    <Plus size={16} />
                    Add Connection
                </button>
            </div>

            {/* Add form */}
            {showForm && (
                <div className="panel p-5 animate-slide-down">
                    <form onSubmit={handleAddKey} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-1.5">Provider</label>
                                <Select
                                    value={formData.provider}
                                    onChange={val => setFormData({ ...formData, provider: val })}
                                    options={providerOptions}
                                    placeholder="Select provider"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-1.5">API Key</label>
                                <input
                                    type="password"
                                    className="input-field w-full"
                                    placeholder="sk-..."
                                    value={formData.key}
                                    onChange={e => setFormData({ ...formData, key: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" className="btn-primary flex items-center gap-2">
                                <Key size={14} />
                                Add Key
                            </button>
                            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Grouped provider keys */}
            {Object.entries(grouped).length === 0 && !loading ? (
                <div className="panel p-12 text-center text-textMuted text-sm">
                    No dynamic keys configured. The system is using .env keys only.
                </div>
            ) : (
                Object.entries(grouped).map(([provider, providerKeys]) => (
                    <div key={provider} className="panel overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-border bg-surfaceHover/30 flex items-center gap-3">
                            <span className="font-semibold text-sm capitalize">{provider}</span>
                            <span className="badge-neutral font-mono">
                                {providerKeys.length} {providerKeys.length === 1 ? 'key' : 'keys'}
                            </span>
                        </div>

                        <div className="divide-y divide-border/50">
                            {providerKeys.map(key => (
                                <div key={key.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-surfaceHover/30 transition-colors">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <Key size={14} className="text-textMuted shrink-0" />
                                        <span className="text-sm text-textSecondary truncate">
                                            {String(key.id || '').includes('env')
                                                ? `Key #${parseInt(String(key.id).split('-').pop()) + 1}`
                                                : 'Database Key'
                                            }
                                        </span>
                                        {key.source === 'env' ? (
                                            <span className="badge bg-blue-500/10 text-blue-400 font-mono text-[10px]">.ENV</span>
                                        ) : (
                                            <span className="badge bg-purple-500/10 text-purple-400 font-mono text-[10px]">DB</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        {key.created_at && (
                                            <span className="text-[11px] text-textMuted font-mono hidden md:block">
                                                {new Date(key.created_at).toLocaleDateString()}
                                            </span>
                                        )}

                                        {key.source === 'env' ? (
                                            <span className="badge-success text-[11px]">
                                                <CheckCircle size={11} /> Active
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleToggleStatus(key.id, key.is_active)}
                                                className={`badge text-[11px] cursor-pointer transition-colors ${
                                                    key.is_active
                                                        ? 'bg-secondary/10 text-secondary hover:bg-secondary/20'
                                                        : 'bg-surfaceHighlight text-textMuted hover:bg-surfaceHover'
                                                }`}
                                            >
                                                {key.is_active ? <><CheckCircle size={11} /> Active</> : <><XCircle size={11} /> Inactive</>}
                                            </button>
                                        )}

                                        {key.source !== 'env' && (
                                            <button
                                                onClick={() => requestDelete(key.id)}
                                                className="p-1.5 rounded-lg text-textMuted hover:text-error hover:bg-error/5 transition-colors"
                                                title="Delete Key"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
