import React, { useState, useEffect } from 'react';
import api from '../api';
import { Search, Filter, ChevronLeft, ChevronRight, Clock, DollarSign, Database, CheckCircle, XCircle } from 'lucide-react';

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

    useEffect(() => {
        fetchLogs();
    }, [page, providerFilter, statusFilter]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">Request Explorer</h2>
                    <p className="text-textDim">Detailed log of all API requests processed by the wrapper.</p>
                </div>
                <div className="flex gap-2">
                    <select
                        className="input-field text-sm"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="200">200 OK</option>
                        <option value="429">429 Rate Limit</option>
                        <option value="500">500 Error</option>
                    </select>
                    <select
                        className="input-field text-sm"
                        value={providerFilter}
                        onChange={e => setProviderFilter(e.target.value)}
                    >
                        <option value="">All Providers</option>
                        <option value="openai">OpenAI</option>
                        <option value="groq">Groq</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="mistral">Mistral</option>
                    </select>
                </div>
            </div>

            <div className="glass-panel overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-textDim uppercase text-xs">
                        <tr>
                            <th className="p-4 font-medium">Time</th>
                            <th className="p-4 font-medium">Client</th>
                            <th className="p-4 font-medium">Provider / Model</th>
                            <th className="p-4 font-medium font-heading tracking-wider">Status</th>
                            <th className="p-4 font-medium font-heading tracking-wider text-right">Tokens</th>
                            <th className="p-4 font-medium font-heading tracking-wider">Latency</th>
                            <th className="p-4 font-medium text-right">Cost</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs.map(log => (
                            <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 text-textDim text-xs font-mono">
                                    {new Date(log.timestamp.endsWith('Z') ? log.timestamp : log.timestamp + 'Z').toLocaleString()}
                                </td>
                                <td className="p-4 font-medium">
                                    {log.client_name ? (
                                        <span className="text-primary">{log.client_name}</span>
                                    ) : (
                                        <span className="text-textDim italic">System / Legacy</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <Database size={14} className="text-textDim" />
                                        <span className="capitalize">{log.provider}</span>
                                        <span className="text-textDim text-xs bg-white/10 px-1.5 py-0.5 rounded ml-1">{log.model}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    {log.status_code === 200 ? (
                                        <span className="inline-flex items-center gap-1 text-secondary text-xs font-bold uppercase tracking-wider">
                                            <CheckCircle size={12} /> Success
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-error text-xs font-bold uppercase tracking-wider">
                                            <XCircle size={12} /> {log.status_code}
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-right font-mono text-textDim text-xs">
                                    <div>{log.prompt_tokens + log.completion_tokens}</div>
                                    <div className="opacity-50 text-[10px]">{log.prompt_tokens} / {log.completion_tokens}</div>
                                </td>
                                <td className="p-4 font-mono text-textDim">
                                    {log.latency_ms}ms
                                </td>
                                <td className="p-4 text-right font-mono text-text">
                                    ${log.cost_usd ? log.cost_usd.toFixed(6) : '0.000000'}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && !loading && (
                            <tr>
                                <td colSpan="6" className="p-12 text-center text-textDim">
                                    No requests found matching filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                <div className="p-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-textDim">
                        Showing {logs.length} of {pagination.total_items} results
                    </span>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="p-2 hover:bg-white/10 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="flex items-center px-2 text-sm font-mono text-textDim">
                            Page {page} of {pagination.total_pages || 1}
                        </span>
                        <button
                            disabled={page >= pagination.total_pages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-2 hover:bg-white/10 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
