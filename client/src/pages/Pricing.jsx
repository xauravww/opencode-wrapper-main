import React, { useState, useEffect } from 'react';
import api from '../api';
import { DollarSign, Plus, Trash2, Save, X, Search, Edit3 } from 'lucide-react';
import Select from '../components/Select';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';

export default function Pricing() {
    const [pricing, setPricing] = useState([]);
    const [providersList, setProvidersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [formData, setFormData] = useState({ provider: '', model: '', input_cost_per_1m: 0, output_cost_per_1m: 0 });
    const [toast, setToast] = useState({ message: '', type: 'success' });
    const [confirmState, setConfirmState] = useState({ open: false, id: null });

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
            setToast({ message: 'Failed to load pricing data.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const fetchProviders = async () => {
        try {
            const res = await api.get('/admin/providers');
            setProvidersList(['default', ...Object.keys(res.data)]);
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
            setToast({ message: isEditMode ? 'Rate updated.' : 'Rate added.', type: 'success' });
            setShowModal(false);
            fetchPricing();
        } catch (error) {
            setToast({ message: 'Failed to save rate.', type: 'error' });
        }
    };

    const requestDelete = (e, id) => {
        e.stopPropagation();
        setConfirmState({ open: true, id });
    };

    const handleDelete = async () => {
        const id = confirmState.id;
        setConfirmState({ open: false, id: null });
        try {
            await api.delete(`/admin/pricing/${id}`);
            setToast({ message: 'Rate deleted.', type: 'success' });
            fetchPricing();
        } catch (error) {
            setToast({ message: 'Failed to delete rate.', type: 'error' });
        }
    };

    const filteredPricing = pricing.filter(p =>
        p.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.model.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="page-title">Model Pricing</h2>
                    <p className="page-subtitle">Manage cost rates per 1M tokens. Click a card to edit.</p>
                </div>
                <button onClick={openAddModal} className="btn-primary flex items-center gap-2 shrink-0">
                    <Plus size={16} />
                    Add Rate
                </button>
            </div>

            <ConfirmDialog
                open={confirmState.open}
                title="Delete pricing rate"
                message="This rate will be removed permanently."
                confirmLabel="Delete"
                onConfirm={handleDelete}
                onCancel={() => setConfirmState({ open: false, id: null })}
            />
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

            {/* Search */}
            <div className="flex items-center gap-2.5 panel px-4 py-2.5 focus-within:border-borderLight transition-colors">
                <Search className="text-textMuted shrink-0" size={16} />
                <input
                    type="text"
                    placeholder="Search by provider or model..."
                    className="bg-transparent border-none outline-none w-full text-sm placeholder-textMuted"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="text-textMuted hover:text-text">
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="panel-elevated w-full max-w-md p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                {isEditMode ? <Edit3 size={18} className="text-primary" /> : <DollarSign size={18} className="text-primary" />}
                                {isEditMode ? 'Edit Rate' : 'Add Rate'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-textMuted hover:text-text hover:bg-surfaceHover transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-1.5">Provider</label>
                                <div className={isEditMode ? 'opacity-50 pointer-events-none' : ''}>
                                    <Select
                                        value={formData.provider}
                                        onChange={val => setFormData({ ...formData, provider: val })}
                                        options={providersList.map(p => ({ value: p, label: p }))}
                                        placeholder="Select provider"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-1.5">Model</label>
                                <input
                                    type="text"
                                    className={`input-field w-full ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    placeholder="gpt-4o, *, etc."
                                    value={formData.model}
                                    onChange={e => setFormData({ ...formData, model: e.target.value })}
                                    disabled={isEditMode}
                                    required
                                />
                                {!isEditMode && <p className="text-[10px] text-textMuted mt-1">Use * for provider-wide fallback.</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-1.5">Input $/1M</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        className="input-field w-full font-mono"
                                        value={formData.input_cost_per_1m}
                                        onChange={e => setFormData({ ...formData, input_cost_per_1m: parseFloat(e.target.value) || 0 })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-1.5">Output $/1M</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        className="input-field w-full font-mono"
                                        value={formData.output_cost_per_1m}
                                        onChange={e => setFormData({ ...formData, output_cost_per_1m: parseFloat(e.target.value) || 0 })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2 py-3">
                                    <Save size={15} />
                                    {isEditMode ? 'Update' : 'Save'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost flex-1 border border-border py-3">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    [...Array(6)].map((_, i) => (
                        <div key={i} className="panel h-[180px] animate-pulse" />
                    ))
                ) : filteredPricing.length === 0 ? (
                    <div className="col-span-full panel py-16 text-center">
                        <DollarSign size={40} className="mx-auto text-textMuted opacity-20 mb-4" />
                        <p className="text-sm font-medium text-textMuted">No pricing rates found.</p>
                        <p className="text-xs text-textMuted mt-1">Try adjusting your search or add a new rate.</p>
                    </div>
                ) : (
                    filteredPricing.map(rate => (
                        <div
                            key={rate.id}
                            onClick={() => openEditModal(rate)}
                            className="panel p-5 group hover:border-primary/30 transition-all cursor-pointer relative"
                        >
                            {/* Delete button */}
                            <button
                                onClick={(e) => requestDelete(e, rate.id)}
                                className="absolute top-3 right-3 p-1.5 rounded-lg text-textMuted opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/5 transition-all z-10"
                            >
                                <Trash2 size={14} />
                            </button>

                            {/* Provider badge + model */}
                            <div className="mb-4">
                                <span className="badge bg-primary/10 text-primary text-[10px] font-mono mb-2">
                                    {rate.provider}
                                </span>
                                <h4 className="text-base font-bold truncate mt-1.5 tracking-tight">
                                    {rate.model === '*' ? 'Default (catch-all)' : rate.model}
                                </h4>
                            </div>

                            {/* Costs */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] text-textMuted uppercase tracking-wider mb-0.5">Input /1M</p>
                                    <p className="text-lg font-bold font-mono text-primary tracking-tight">${rate.input_cost_per_1m}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-textMuted uppercase tracking-wider mb-0.5">Output /1M</p>
                                    <p className="text-lg font-bold font-mono tracking-tight">${rate.output_cost_per_1m}</p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                                <span className="text-[10px] text-textMuted font-mono">
                                    {rate.updated_at ? new Date(rate.updated_at).toLocaleDateString() : '—'}
                                </span>
                                <Edit3 size={12} className="text-textMuted opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
