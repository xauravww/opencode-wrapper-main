import React, { useState, useEffect } from 'react';
import api from '../api';
import { Copy, Plus, Trash, Check } from 'lucide-react';

export default function ClientKeys() {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [generatedKey, setGeneratedKey] = useState(null);
    const [copied, setCopied] = useState(false);

    const fetchKeys = async () => {
        try {
            const res = await api.get('/keys');
            setKeys(res.data);
            setLoading(false);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            const res = await api.post('/keys', { name: newKeyName });
            setGeneratedKey(res.data);
            setNewKeyName('');
            fetchKeys();
        } catch (error) {
            console.error(error);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to revoke this key?')) return;
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
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Client API Keys</h2>
                    <p className="text-textDim">Manage access keys for applications using the wrapper.</p>
                </div>

                {/* Creation Form */}
                <form onSubmit={handleCreate} className="flex gap-2">
                    <input
                        type="text"
                        placeholder="App Name (e.g. Website A)"
                        className="input-field w-64"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        required
                    />
                    <button type="submit" className="btn-primary flex items-center gap-2" disabled={creating}>
                        <Plus size={18} />
                        Generate Key
                    </button>
                </form>
            </div>

            {/* Generated Key Modal/Alert */}
            {generatedKey && (
                <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-6 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-secondary font-bold text-lg">Key Generated Successfully</h3>
                        <button onClick={() => setGeneratedKey(null)} className="text-textDim hover:text-text">Close</button>
                    </div>
                    <p className="text-sm">Make sure to copy this key now. You won't be able to see it again!</p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-black/30 p-3 rounded-lg font-mono text-secondary break-all">
                            {generatedKey.api_key}
                        </code>
                        <button onClick={copyToClipboard} className="bg-surface hover:bg-white/5 p-3 rounded-lg transition-colors">
                            {copied ? <Check size={20} className="text-secondary" /> : <Copy size={20} />}
                        </button>
                    </div>
                </div>
            )}

            {/* Keys List */}
            <div className="glass-panel overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 text-xs text-textDim uppercase">
                        <tr>
                            <th className="p-4 font-medium">Name</th>
                            <th className="p-4 font-medium">Key Prefix</th>
                            <th className="p-4 font-medium">Created At</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {keys.map(key => (
                            <tr key={key.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 font-medium">{key.name}</td>
                                <td className="p-4 font-mono text-sm text-textDim">{key.prefix}</td>
                                <td className="p-4 text-sm text-textDim">{new Date(key.created_at).toLocaleDateString()}</td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${key.is_active ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'}`}>
                                        {key.is_active ? 'Active' : 'Revoked'}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <button
                                        onClick={() => handleDelete(key.id)}
                                        className="text-textDim hover:text-error transition-colors p-2"
                                        title="Revoke Key"
                                    >
                                        <Trash size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {keys.length === 0 && !loading && (
                            <tr>
                                <td colSpan="5" className="p-8 text-center text-textDim">No keys found. Create one above.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
