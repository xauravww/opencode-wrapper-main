import React, { useState, useEffect } from 'react';
import api from '../api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, DollarSign, Zap, Server } from 'lucide-react';

const StatCard = ({ title, value, subValue, icon: Icon, color }) => (
    <div className="glass-panel p-6 flex flex-col justify-between h-32 relative overflow-hidden group">
        <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 bg-${color}-500 blur-2xl group-hover:opacity-20 transition-all`} />
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-textDim text-xs uppercase tracking-wider">{title}</span>
                <Icon size={16} className={`text-${color}-400`} />
            </div>
            <div className="text-2xl font-bold">{value}</div>
        </div>
        {subValue && <div className="text-xs text-textDim">{subValue}</div>}
    </div>
);

const ProviderRow = ({ name, data }) => {
    let statusColor = 'bg-error'; // Red
    if (data.health_status === 'healthy') statusColor = 'bg-secondary'; // Green
    if (data.health_status === 'degraded') statusColor = 'bg-warning'; // Yellow

    return (
        <div className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${statusColor} shadow-[0_0_8px_currentColor]`} />
                <div>
                    <div className="font-medium capitalize">{name}</div>
                    <div className="text-xs text-textDim">Priority: {Math.round(data.priority)}</div>
                </div>
            </div>
            <div className="flex items-center gap-8 text-right">
                <div>
                    <div className="text-sm font-mono">{Math.round(data.avg_response_time)}ms</div>
                    <div className="text-xs text-textDim">Latency</div>
                </div>
                <div>
                    <div className="text-sm font-mono">{Math.round(data.speed_score)}</div>
                    <div className="text-xs text-textDim">Speed Score</div>
                </div>
                <div>
                    <div className="text-sm font-mono">{(data.error_rate * 100).toFixed(1)}%</div>
                    <div className="text-xs text-textDim">Error Rate</div>
                </div>
            </div>
        </div>
    );
};

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [providers, setProviders] = useState({});
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [statsRes, providersRes] = await Promise.all([
                api.get('/admin/stats'),
                api.get('/admin/providers')
            ]);
            setStats(statsRes.data);
            setProviders(providersRes.data);
            setLoading(false);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="animate-pulse flex items-center gap-2 text-textDim">Loading stats...</div>;

    const chartData = stats.dailyCosts?.map(item => ({
        date: item.date.substring(5), // mm-dd
        cost: item.cost
    })) || [];

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Requests"
                    value={stats.totalRequests.toLocaleString()}
                    subValue="All time"
                    icon={Activity}
                    color="primary"
                />
                <StatCard
                    title="Avg Latency"
                    value={`${Math.round(stats.avgLatency)} ms`}
                    subValue="Global average"
                    icon={Zap}
                    color="warning"
                />
                <StatCard
                    title="Total Cost"
                    value={`$${stats.totalCost.toFixed(4)}`}
                    subValue="Estimated USD"
                    icon={DollarSign}
                    color="secondary"
                />
                <StatCard
                    title="Active Providers"
                    value={stats.activeProviders}
                    subValue={`out of ${stats.configuredProviders} configured`}
                    icon={Server}
                    color="primary"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Chart Section */}
                <div className="lg:col-span-2 glass-panel p-6">
                    <h3 className="text-lg font-bold mb-6">Cost History (7 Days)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00D1FF" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#00D1FF" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#121212', borderColor: '#333', borderRadius: '8px' }}
                                    itemStyle={{ color: '#00D1FF' }}
                                    formatter={(value) => [`$${Number(value).toFixed(4)}`, 'Cost']}
                                />
                                <Area type="monotone" dataKey="cost" stroke="#00D1FF" strokeWidth={2} fillOpacity={1} fill="url(#colorCost)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Provider Status */}
                <div className="glass-panel overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-white/5">
                        <h3 className="text-lg font-bold">Provider Health</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[400px]">
                        {Object.entries(providers)
                            .sort(([, a], [, b]) => b.priority - a.priority)
                            .map(([name, data]) => (
                                <ProviderRow key={name} name={name} data={data} />
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
