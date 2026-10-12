import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { Search, ChevronDown, Power, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Select from '../components/Select';
import Toast from '../components/Toast';
import Toggle from '../components/Toggle';

const filterOptions = [
    { value: 'all', label: 'All models' },
    { value: 'enabled', label: 'Enabled only' },
    { value: 'disabled', label: 'Disabled only' },
];

export default function Models() {
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [collapsed, setCollapsed] = useState({});
    const [pending, setPending] = useState(new Set());
    const [bulkPending, setBulkPending] = useState(null);
    const [toast, setToast] = useState({ message: '', type: 'success' });

    const fetchModels = async (silent = false) => {
        if (silent) setRefreshing(true);
        try {
            const res = await api.get('/admin/models');
            setData(res.data || {});
        } catch (error) {
            setToast({ message: 'Failed to load models', type: 'error' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchModels(); }, []);

    const providers = useMemo(() => {
        const q = query.trim().toLowerCase();
        return Object.entries(data)
            .map(([name, models]) => {
                const filtered = models.filter(m => {
                    if (q && !m.id.toLowerCase().includes(q)) return false;
                    if (filter === 'enabled' && !m.enabled) return false;
                    if (filter === 'disabled' && m.enabled) return false;
                    return true;
                });
                return { name, models, filtered };
            })
            .filter(p => p.filtered.length > 0)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [data, query, filter]);

    const totals = useMemo(() => {
        let enabled = 0, total = 0;
        Object.values(data).forEach(models => {
            total += models.length;
            enabled += models.filter(m => m.enabled).length;
        });
        return { enabled, total };
    }, [data]);

    const toggleModel = async (provider, model, enabled) => {
        const key = `${provider}::${model}`;
        setPending(prev => new Set(prev).add(key));
        setData(prev => ({
            ...prev,
            [provider]: prev[provider].map(m => m.id === model ? { ...m, enabled } : m)
        }));

        try {
            await api.patch('/admin/models/status', { provider, model, enabled });
        } catch (error) {
            setData(prev => ({
                ...prev,
                [provider]: prev[provider].map(m => m.id === model ? { ...m, enabled: !enabled } : m)
            }));
            setToast({ message: `Failed to ${enabled ? 'enable' : 'disable'} ${model}`, type: 'error' });
        } finally {
            setPending(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    };

    const bulkToggle = async (provider, enabled) => {
        const previous = data[provider];
        setBulkPending(provider);
        setData(prev => ({
            ...prev,
            [provider]: prev[provider].map(m => ({ ...m, enabled }))
        }));

        try {
            await api.patch('/admin/models/bulk', { provider, enabled });
            setToast({ message: `${provider}: all models ${enabled ? 'enabled' : 'disabled'}`, type: 'success' });
        } catch (error) {
            setData(prev => ({ ...prev, [provider]: previous }));
            setToast({ message: `Failed to update ${provider} models`, type: 'error' });
        } finally {
            setBulkPending(null);
        }
    };

    const toggleCollapse = (provider) => {
        setCollapsed(prev => ({ ...prev, [provider]: !prev[provider] }));
    };

    return (
        <div className="max-w-5xl space-y-6">
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="page-title">Models</h2>
                    <p className="page-subtitle">Enable or disable individual models across every provider.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="badge-neutral font-mono">{totals.enabled}/{totals.total} enabled</span>
                    <button
                        onClick={() => fetchModels(true)}
                        disabled={refreshing}
                        className="btn-ghost flex items-center gap-2"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted" />
                    <input
                        type="text"
                        className="input-field w-full pl-10"
                        placeholder="Search models..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                </div>
                <Select
                    value={filter}
                    onChange={setFilter}
                    options={filterOptions}
                    className="sm:w-52"
                />
            </div>

            {loading ? (
                <div className="panel p-12 flex items-center justify-center gap-3 text-textMuted text-sm">
                    <RefreshCw size={16} className="animate-spin" /> Loading models...
                </div>
            ) : providers.length === 0 ? (
                <div className="panel p-12 text-center text-textMuted text-sm">
                    {query || filter !== 'all'
                        ? 'No models match the current filters.'
                        : 'No models discovered yet. Add a provider key and refresh.'}
                </div>
            ) : (
                providers.map(({ name, models, filtered }) => {
                    const enabledCount = models.filter(m => m.enabled).length;
                    const allEnabled = enabledCount === models.length;
                    const noneEnabled = enabledCount === 0;
                    const isCollapsed = collapsed[name];

                    return (
                        <div key={name} className="panel overflow-hidden">
                            <div className="px-5 py-3.5 border-b border-border bg-surfaceHover/30 flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => toggleCollapse(name)}
                                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                >
                                    <ChevronDown
                                        size={16}
                                        className={`text-textMuted shrink-0 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                                    />
                                    <span className="font-semibold text-sm capitalize truncate">{name}</span>
                                    <span className={`badge font-mono ${allEnabled ? 'badge-success' : noneEnabled ? 'badge-error' : 'badge-neutral'}`}>
                                        {enabledCount}/{models.length}
                                    </span>
                                </button>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => bulkToggle(name, true)}
                                        disabled={bulkPending === name || allEnabled}
                                        className="badge cursor-pointer transition-colors text-[11px] bg-secondary/10 text-secondary hover:bg-secondary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <CheckCircle size={11} /> All
                                    </button>
                                    <button
                                        onClick={() => bulkToggle(name, false)}
                                        disabled={bulkPending === name || noneEnabled}
                                        className="badge cursor-pointer transition-colors text-[11px] bg-error/10 text-error hover:bg-error/20 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <XCircle size={11} /> None
                                    </button>
                                </div>
                            </div>

                            <AnimatePresence initial={false}>
                                {!isCollapsed && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                                        className="overflow-hidden"
                                    >
                                        <div className="divide-y divide-border/50">
                                            {filtered.map(model => {
                                                const key = `${name}::${model.id}`;
                                                return (
                                                    <div
                                                        key={model.id}
                                                        className="px-5 py-3 flex items-center gap-4 hover:bg-surfaceHover/30 transition-colors"
                                                    >
                                                        <span className={`flex-1 min-w-0 truncate text-sm font-mono ${model.enabled ? 'text-textSecondary' : 'text-textMuted line-through'}`}>
                                                            {model.id}
                                                        </span>
                                                        <Toggle
                                                            checked={model.enabled}
                                                            disabled={pending.has(key)}
                                                            onChange={(next) => toggleModel(name, model.id, next)}
                                                            title={model.enabled ? 'Disable model' : 'Enable model'}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })
            )}

            <p className="text-xs text-textMuted flex items-center gap-2">
                <Power size={12} />
                Disabled models are removed from routing and hidden from the public /v1/models list.
            </p>
        </div>
    );
}
