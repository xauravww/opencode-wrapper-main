import React, { useState, useEffect } from 'react';
import api from '../api';
import { Copy, Plus, Trash2, Check, Key, X, AlertCircle } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';

export default function ClientKeys() {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [generatedKey, setGeneratedKey] = useState(null);
    const [copied, setCopied] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [confirmState, setConfirmState] = useState({ open: false, id: null });

    const fetchKeys = async () => {
        try {
            const res = await api.get('/keys');
            setKeys(res.data);
            setLoading(false);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => { fetchKeys(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            const res = await api.post('/keys', { name: newKeyName });
            setGeneratedKey(res.data);
            setNewKeyName('');
            setShowForm(false);
            fetchKeys();
        } catch (error) {
            console.error(error);
        } finally {
            setCreating(false);
        }
    };

    const requestDelete = (id) => {
        setConfirmState({ open: true, id });
    };

    const handleDelete = async () => {
        const id = confirmState.id;
        setConfirmState({ open: false, id: null });
        try {
            await api.delete(`/keys/${id}`);
            fetchKeys();
        } catch (error) {
            console.error(error);
        }
    };

    const copyToClipboard = () => {
        if (generatedKey) {
            navigator.clipboard.writeText(generatedKey.api_key);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="max-w-5xl space-y-6">
            <ConfirmDialog
                open={confirmState.open}
                title="Revoke API key"
                message="This key will stop working immediately. This cannot be undone."
                confirmLabel="Revoke"
                onConfirm={handleDelete}
                onCancel={() => setConfirmState({ open: false, id: null })}
            />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="page-title">Client API Keys</h2>
                    <p className="page-subtitle">Manage access keys for applications using the wrapper.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="btn-primary flex items-center gap-2 shrink-0"
                >
                    <Plus size={16} />
                    New Key
                </button>
            </div>

            {/* Create form */}
            {showForm && (
                <div className="panel p-5 animate-slide-down">
                    <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="text"
                            placeholder="Application name (e.g. Website, Mobile App)"
                            className="input-field flex-1"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            autoFocus
                            required
                        />
                        <div className="flex gap-2">
                            <button type="submit" className="btn-primary flex items-center gap-2" disabled={creating}>
                                {creating ? (
                                    <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Key size={14} />
                                        Generate
                                    </>
                                )}
                            </button>
                            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Generated key alert */}
            {generatedKey && (
                <div className="panel border-secondary/30 p-5 animate-slide-down">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 text-secondary font-semibold text-sm">
                            <Check size={16} />
                            Key Generated Successfully
                        </div>
                        <button onClick={() => setGeneratedKey(null)} className="text-textMuted hover:text-text p-1">
                            <X size={14} />
                        </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-textSecondary mb-3">
                        <AlertCircle size={12} />
                        Copy now — you won't see this key again.
                    </div>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-background px-3 py-2.5 rounded-xl font-mono text-sm text-secondary break-all border border-border">
                            {generatedKey.api_key}
                        </code>
                        <button
                            onClick={copyToClipboard}
                            className="btn-ghost border border-border shrink-0"
                        >
                            {copied ? <Check size={16} className="text-secondary" /> : <Copy size={16} />}
                        </button>
                    </div>
                </div>
            )}

            {/* Keys table - desktop */}
            <div className="panel overflow-hidden hidden sm:block">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="px-5 py-3 table-header">Name</th>
                            <th className="px-5 py-3 table-header">Key Prefix</th>
                            <th className="px-5 py-3 table-header">Created</th>
                            <th className="px-5 py-3 table-header">Status</th>
                            <th className="px-5 py-3 table-header text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {keys.map(key => (
                            <tr key={key.id} className="hover:bg-surfaceHover/50 transition-colors">
                                <td className="px-5 py-3.5 font-medium text-sm">{key.name}</td>
                                <td className="px-5 py-3.5 font-mono text-xs text-textSecondary">{key.prefix}</td>
                                <td className="px-5 py-3.5 text-xs text-textSecondary">
                                    {new Date(key.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-5 py-3.5">
                                    <span className={key.is_active ? 'badge-success' : 'badge-error'}>
                                        {key.is_active ? 'Active' : 'Revoked'}
                                    </span>
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                    <button
                                        onClick={() => requestDelete(key.id)}
                                        className="p-1.5 rounded-lg text-textMuted hover:text-error hover:bg-error/5 transition-colors"
                                        title="Revoke Key"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {keys.length === 0 && !loading && (
                            <tr>
                                <td colSpan="5" className="px-5 py-12 text-center text-textMuted text-sm">
                                    No keys yet. Create one to get started.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Keys cards - mobile */}
            <div className="sm:hidden space-y-3">
                {keys.map(key => (
                    <div key={key.id} className="panel p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{key.name}</span>
                            <span className={key.is_active ? 'badge-success' : 'badge-error'}>
                                {key.is_active ? 'Active' : 'Revoked'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-mono text-xs text-textSecondary">{key.prefix}</p>
                                <p className="text-[11px] text-textMuted mt-0.5">
                                    {new Date(key.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => requestDelete(key.id)}
                                className="p-2 rounded-lg text-textMuted hover:text-error hover:bg-error/5 transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
                {keys.length === 0 && !loading && (
                    <div className="panel p-8 text-center text-textMuted text-sm">
                        No keys yet. Create one to get started.
                    </div>
                )}
            </div>
        </div>
    );
}
