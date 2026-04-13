import React, { useState, useEffect } from 'react';
import api from '../api';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Database, Filter } from 'lucide-react';
import Select from '../components/Select';

const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: '200', label: '200 OK' },
    { value: '429', label: '429 Rate Limit' },
    { value: '500', label: '500 Error' },
];

const providerOptions = [
    { value: '', label: 'All Providers' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'groq', label: 'Groq' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'google', label: 'Google' },
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'together', label: 'Together' },
];

export default function RequestLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({});
    const [providerFilter, setProviderFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = { page, limit: 20 };
            if (providerFilter) params.provider = providerFilter;
            if (statusFilter) params.status = statusFilter;

            const res = await api.get('/admin/logs', { params });
            setLogs(res.data.data);
            setPagination(res.data.pagination);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, [page, providerFilter, statusFilter]);

    return (
        <div className="space-y-6">
            {/* Header + Filters */}
            <div className="flex flex-col gap-4">
                <div>
                    <h2 className="page-title">Request Explorer</h2>
                    <p className="page-subtitle">Detailed log of all API requests processed by the wrapper.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Filter size={14} className="text-textMuted" />
                    <Select
                        value={statusFilter}
                        onChange={val => { setStatusFilter(val); setPage(1); }}
                        options={statusOptions}
                        placeholder="All Statuses"
                        className="w-[160px]"
                    />
                    <Select
                        value={providerFilter}
                        onChange={val => { setProviderFilter(val); setPage(1); }}
                        options={providerOptions}
                        placeholder="All Providers"
                        className="w-[160px]"
                    />
                </div>
            </div>

            {/* Table - desktop */}
            <div className="panel overflow-hidden hidden md:block">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="px-5 py-3 table-header">Time</th>
                                <th className="px-5 py-3 table-header">Client</th>
                                <th className="px-5 py-3 table-header">Provider / Model</th>
                                <th className="px-5 py-3 table-header">Status</th>
                                <th className="px-5 py-3 table-header text-right">Tokens</th>
                                <th className="px-5 py-3 table-header text-right">Latency</th>
                                <th className="px-5 py-3 table-header text-right">Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {logs.map(log => (
                                <tr key={log.id} className="hover:bg-surfaceHover/50 transition-colors">
                                    <td className="px-5 py-3 text-xs text-textSecondary font-mono whitespace-nowrap">
                                        {new Date(log.timestamp.endsWith('Z') ? log.timestamp : log.timestamp + 'Z').toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="px-5 py-3">
                                        {log.client_name ? (
                                            <span className="text-sm font-medium text-primary">{log.client_name}</span>
                                        ) : (
                                            <span className="text-xs text-textMuted italic">System</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm capitalize">{log.provider}</span>
                                            <span className="badge-neutral font-mono text-[10px]">{log.model}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        {log.status_code === 200 ? (
                                            <span className="badge-success text-[11px]">
                                                <CheckCircle size={11} /> OK
                                            </span>
                                        ) : (
                                            <span className="badge-error text-[11px]">
                                                <XCircle size={11} /> {log.status_code}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono text-xs text-textSecondary">
                                        <div>{(log.prompt_tokens + log.completion_tokens).toLocaleString()}</div>
                                        <div className="text-[10px] text-textMuted">{log.prompt_tokens} / {log.completion_tokens}</div>
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono text-xs text-textSecondary">
                                        {log.latency_ms}ms
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono text-xs font-medium">
                                        ${log.cost_usd ? log.cost_usd.toFixed(6) : '0.000000'}
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="7" className="px-5 py-12 text-center text-textMuted text-sm">
                                        No requests found matching filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-textMuted">
                        {logs.length} of {pagination.total_items || 0} results
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="p-1.5 rounded-lg hover:bg-surfaceHover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="px-3 py-1 text-xs font-mono text-textSecondary">
                            {page} / {pagination.total_pages || 1}
                        </span>
                        <button
                            disabled={page >= (pagination.total_pages || 1)}
                            onClick={() => setPage(p => p + 1)}
                            className="p-1.5 rounded-lg hover:bg-surfaceHover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Cards - mobile */}
            <div className="md:hidden space-y-3">
                {logs.map(log => (
                    <div key={log.id} className="panel p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-sm capitalize font-medium">{log.provider}</span>
                                <span className="badge-neutral font-mono text-[10px]">{log.model}</span>
                            </div>
                            {log.status_code === 200 ? (
                                <span className="badge-success text-[11px]"><CheckCircle size={11} /> OK</span>
                            ) : (
                                <span className="badge-error text-[11px]"><XCircle size={11} /> {log.status_code}</span>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                                <div className="text-xs font-mono font-medium">{(log.prompt_tokens + log.completion_tokens).toLocaleString()}</div>
                                <div className="text-[10px] text-textMuted">tokens</div>
                            </div>
                            <div>
                                <div className="text-xs font-mono font-medium">{log.latency_ms}ms</div>
                                <div className="text-[10px] text-textMuted">latency</div>
                            </div>
                            <div>
                                <div className="text-xs font-mono font-medium">${log.cost_usd?.toFixed(6) || '0'}</div>
                                <div className="text-[10px] text-textMuted">cost</div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-textMuted">
                            <span>{log.client_name || 'System'}</span>
                            <span className="font-mono">
                                {new Date(log.timestamp.endsWith('Z') ? log.timestamp : log.timestamp + 'Z').toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}
                {logs.length === 0 && !loading && (
                    <div className="panel p-12 text-center text-textMuted text-sm">No requests found.</div>
                )}

                {/* Mobile pagination */}
                <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-textMuted">{logs.length} of {pagination.total_items || 0}</span>
                    <div className="flex items-center gap-1">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="p-2 rounded-lg hover:bg-surfaceHover disabled:opacity-30 transition-colors"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="px-2 text-xs font-mono text-textSecondary">{page}/{pagination.total_pages || 1}</span>
                        <button
                            disabled={page >= (pagination.total_pages || 1)}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 rounded-lg hover:bg-surfaceHover disabled:opacity-30 transition-colors"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
