import React, { useState, useEffect } from 'react';
import api from '../api';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, Server, BarChart3 } from 'lucide-react';

const COLORS = ['#E5A84B', '#7FB685', '#E05C6C', '#D4943A', '#8B7EC8', '#5BA3CF'];

const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="panel px-3 py-2 text-xs">
            <p className="text-textSecondary mb-0.5">{payload[0].payload.client_name || payload[0].payload.provider_name || payload[0].name}</p>
            <p className="font-mono font-medium text-primary">${Number(payload[0].value).toFixed(6)}</p>
        </div>
    );
};

export default function UsageReport() {
    const [data, setData] = useState({ costByClient: [], costByProvider: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.get('/admin/usage-report');
                setData(res.data);
                setLoading(false);
            } catch (error) {
                console.error(error);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-8 w-48 bg-surfaceHover rounded-lg" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="panel h-[320px]" />
                    <div className="panel h-[320px]" />
                </div>
                <div className="panel h-[200px]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="page-title">Usage Reports</h2>
                <p className="page-subtitle">Token usage and cost breakdown by client and provider.</p>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Cost by Client */}
                <div className="panel p-5">
                    <div className="flex items-center gap-2 mb-5">
                        <Users size={15} className="text-textMuted" />
                        <h3 className="font-semibold text-sm">Cost by Client</h3>
                    </div>
                    <div className="h-[240px] -ml-2">
                        {data.costByClient.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.costByClient} layout="vertical">
                                    <XAxis
                                        type="number"
                                        stroke="#3a3a46"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: '#6B6A72' }}
                                        tickFormatter={v => `$${v}`}
                                    />
                                    <YAxis
                                        dataKey="client_name"
                                        type="category"
                                        stroke="#3a3a46"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: '#9B9AA0' }}
                                        width={90}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                                    <Bar dataKey="total_cost" fill="#E5A84B" radius={[0, 4, 4, 0]} barSize={18} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-textMuted text-sm">No data</div>
                        )}
                    </div>
                </div>

                {/* Cost by Provider */}
                <div className="panel p-5">
                    <div className="flex items-center gap-2 mb-5">
                        <Server size={15} className="text-textMuted" />
                        <h3 className="font-semibold text-sm">Cost by Provider</h3>
                    </div>
                    <div className="h-[240px]">
                        {data.costByProvider.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data.costByProvider}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={75}
                                        paddingAngle={3}
                                        dataKey="total_cost"
                                        nameKey="provider"
                                        strokeWidth={0}
                                    >
                                        {data.costByProvider.map((_, index) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        verticalAlign="middle"
                                        align="right"
                                        layout="vertical"
                                        formatter={(value) => <span className="text-xs text-textSecondary">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-textMuted text-sm">No data</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Detail Table */}
            <div className="panel overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border">
                    <div className="flex items-center gap-2">
                        <BarChart3 size={15} className="text-textMuted" />
                        <h3 className="font-semibold text-sm">Detailed Client Usage</h3>
                    </div>
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="px-5 py-3 table-header">Client</th>
                                <th className="px-5 py-3 table-header text-right">Requests</th>
                                <th className="px-5 py-3 table-header text-right">Prompt Tokens</th>
                                <th className="px-5 py-3 table-header text-right">Completion Tokens</th>
                                <th className="px-5 py-3 table-header text-right">Total Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {data.costByClient.map((client, idx) => (
                                <tr key={idx} className="hover:bg-surfaceHover/50 transition-colors">
                                    <td className="px-5 py-3.5 font-medium text-sm">{client.client_name || 'System / Legacy'}</td>
                                    <td className="px-5 py-3.5 text-right font-mono text-xs">{client.request_count}</td>
                                    <td className="px-5 py-3.5 text-right font-mono text-xs text-textSecondary">{client.prompt_tokens?.toLocaleString()}</td>
                                    <td className="px-5 py-3.5 text-right font-mono text-xs text-textSecondary">{client.completion_tokens?.toLocaleString()}</td>
                                    <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold text-primary">
                                        ${client.total_cost?.toFixed(6)}
                                    </td>
                                </tr>
                            ))}
                            {data.costByClient.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-5 py-12 text-center text-textMuted text-sm">No data available.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-border/50">
                    {data.costByClient.map((client, idx) => (
                        <div key={idx} className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{client.client_name || 'System'}</span>
                                <span className="font-mono text-xs font-semibold text-primary">${client.total_cost?.toFixed(6)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div>
                                    <div className="text-xs font-mono">{client.request_count}</div>
                                    <div className="text-[10px] text-textMuted">requests</div>
                                </div>
                                <div>
                                    <div className="text-xs font-mono text-textSecondary">{client.prompt_tokens?.toLocaleString()}</div>
                                    <div className="text-[10px] text-textMuted">prompt</div>
                                </div>
                                <div>
                                    <div className="text-xs font-mono text-textSecondary">{client.completion_tokens?.toLocaleString()}</div>
                                    <div className="text-[10px] text-textMuted">completion</div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {data.costByClient.length === 0 && (
                        <div className="p-12 text-center text-textMuted text-sm">No data available.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
