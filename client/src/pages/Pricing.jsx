import React, { useState, useEffect } from 'react';
import api from '../api';
import { DollarSign, Plus, Trash2, Save, X, Search, ChevronRight, AlertCircle, Edit3 } from 'lucide-react';

export default function Pricing() {
    const [pricing, setPricing] = useState([]);
    const [providersList, setProvidersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [formData, setFormData] = useState({ provider: '', model: '', input_cost_per_1m: 0, output_cost_per_1m: 0 });
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        fetchPricing();
        fetchProviders();
    }, []);

    const fetchPricing = async () => {
        try {
            const res = await api.get('/admin/pricing');
            setPricing(res.data);
        } catch (error) {
            console.error('Failed to fetch pricing:', error);
            setMessage({ type: 'error', text: 'Failed to load pricing data.' });
        } finally {
            setLoading(false);
        }
    };

    const fetchProviders = async () => {
        try {
            const res = await api.get('/admin/providers');
            // Extract unique provider names that are configured
            const list = Object.keys(res.data);
            setProvidersList(['default', ...list]);
        } catch (error) {
            console.error('Failed to fetch providers:', error);
        }
    };

    const openAddModal = () => {
        setIsEditMode(false);
        setFormData({ provider: providersList[0] || 'openai', model: '', input_cost_per_1m: 0, output_cost_per_1m: 0 });
        setShowModal(true);
    };

    const openEditModal = (rate) => {
        setIsEditMode(true);
        setFormData({
            provider: rate.provider,
            model: rate.model,
            input_cost_per_1m: rate.input_cost_per_1m,
            output_cost_per_1m: rate.output_cost_per_1m
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/pricing', formData);
            setMessage({
                type: 'success',
                text: isEditMode ? 'Pricing rate updated successfully.' : 'New pricing rate added.'
            });
            setShowModal(false);
            fetchPricing();
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to save pricing rate.' });
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation(); // Don't trigger edit modal
        if (!window.confirm('Are you sure you want to delete this pricing rate?')) return;
        try {
            await api.delete(`/admin/pricing/${id}`);
            setMessage({ type: 'success', text: 'Pricing rate deleted.' });
            fetchPricing();
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to delete pricing rate.' });
        }
    };

    const filteredPricing = pricing.filter(p =>
        p.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.model.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Model Pricing</h2>
                    <p className="text-textDim mt-1">Manage costs per 1M tokens. Click a card to edit existing rates.</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center justify-center gap-2 bg-primary text-background px-4 py-2 rounded-lg font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                >
                    <Plus size={20} /> Add New Rate
                </button>
            </div>

            {message.text && (
                <div className={`p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2 z-10 relative ${message.type === 'success' ? 'bg-success/10 text-success border border-success/20' : 'bg-error/10 text-error border border-error/20'
                    }`}>
                    <AlertCircle size={20} />
                    <span className="font-medium">{message.text}</span>
                    <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto opacity-50 hover:opacity-100">
                        <X size={16} />
                    </button>
                </div>
            )}

            <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/10 group focus-within:border-primary/50 transition-colors">
                <Search className="text-textDim group-focus-within:text-primary transition-colors" size={20} />
                <input
                    type="text"
                    placeholder="Search by provider or model..."
                    className="bg-transparent border-none outline-none w-full text-lg"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="glass-panel w-full max-w-md p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-bold flex items-center gap-3">
                                {isEditMode ? <Edit3 className="text-primary" /> : <DollarSign className="text-primary" />}
                                {isEditMode ? 'Edit Model Rate' : 'Add Model Rate'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-textDim hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-textDim uppercase tracking-widest">Provider</label>
                                <div className="relative">
                                    <select
                                        className={`input-field w-full appearance-none bg-[#1a1a1a] ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        value={formData.provider}
                                        onChange={e => setFormData({ ...formData, provider: e.target.value })}
                                        disabled={isEditMode}
                                        required
                                    >
                                        {providersList.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                    {!isEditMode && <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-textDim pointer-events-none" size={16} />}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-textDim uppercase tracking-widest">Model</label>
                                <input
                                    type="text"
                                    className={`input-field w-full ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    placeholder="gpt-4, *, etc."
                                    value={formData.model}
                                    onChange={e => setFormData({ ...formData, model: e.target.value })}
                                    disabled={isEditMode}
                                    required
                                />
                                {!isEditMode && <p className="text-[10px] text-textDim italic mt-1">Use * for provider-wide fallback.</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-textDim uppercase tracking-widest">Input ($/1M)</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        className="input-field w-full font-mono text-primary"
                                        value={formData.input_cost_per_1m}
                                        onChange={e => setFormData({ ...formData, input_cost_per_1m: parseFloat(e.target.value) || 0 })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-textDim uppercase tracking-widest">Output ($/1M)</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        className="input-field w-full font-mono text-white"
                                        value={formData.output_cost_per_1m}
                                        onChange={e => setFormData({ ...formData, output_cost_per_1m: parseFloat(e.target.value) || 0 })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="pt-6 flex gap-4">
                                <button type="submit" className="flex-1 bg-primary text-background font-bold py-4 rounded-xl hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
                                    <Save size={20} />
                                    {isEditMode ? 'Update Rate' : 'Save Rate'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-white/5 font-bold py-4 rounded-xl hover:bg-white/10 transition-all">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    Array(6).fill(0).map((_, i) => (
                        <div key={i} className="glass-panel h-52 animate-pulse bg-white/5 rounded-2xl" />
                    ))
                ) : filteredPricing.length === 0 ? (
                    <div className="col-span-full py-24 text-center glass-panel rounded-2xl">
                        <DollarSign size={64} className="mx-auto text-textDim opacity-10 mb-6" />
                        <p className="text-2xl font-bold text-textDim">No pricing rates found.</p>
                        <p className="text-textDim mt-2">Try adjusting your search or add a new rate.</p>
                    </div>
                ) : (
                    filteredPricing.map(rate => (
                        <div
                            key={rate.id}
                            onClick={() => openEditModal(rate)}
                            className="glass-panel p-6 group hover:border-primary/40 transition-all hover:-translate-y-1 cursor-pointer relative rounded-2xl overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Edit3 size={16} className="text-primary" />
                            </div>

                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-primary/10 text-primary px-2 py-1 rounded-md border border-primary/20">
                                            {rate.provider}
                                        </span>
                                    </div>
                                    <h4 className="text-xl font-black truncate max-w-[200px] tracking-tight">
                                        {rate.model === '*' ? 'Default Catch-all' : rate.model}
                                    </h4>
                                </div>
                                <button
                                    onClick={(e) => handleDelete(e, rate.id)}
                                    className="p-2 text-textDim hover:text-error hover:bg-error/10 rounded-xl transition-all z-10"
                                    title="Delete this rate"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-6 mb-2">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-textDim uppercase tracking-widest opacity-60">Input (1M)</p>
                                    <p className="text-2xl font-black text-primary font-mono tracking-tighter">${rate.input_cost_per_1m}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-textDim uppercase tracking-widest opacity-60">Output (1M)</p>
                                    <p className="text-2xl font-black text-white font-mono tracking-tighter">${rate.output_cost_per_1m}</p>
                                </div>
                            </div>

                            <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-textDim uppercase tracking-widest font-bold opacity-40">
                                <div className="flex items-center gap-1">
                                    Last Update: {new Date(rate.updated_at).toLocaleDateString()}
                                </div>
                                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
