import React, { useState, useEffect } from 'react';
import api from '../api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, DollarSign, Zap, Server, TrendingUp } from 'lucide-react';

const StatCard = ({ title, value, subValue, icon: Icon, accentColor }) => (
    <div className="panel p-5 group hover:border-borderLight transition-all duration-200">
        <div className="flex items-center justify-between mb-3">
            <span className="table-header">{title}</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentColor}`}>
                <Icon size={15} />
            </div>
        </div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {subValue && <p className="text-xs text-textMuted mt-1">{subValue}</p>}
    </div>
);

const statusConfig = {
    healthy: { color: 'bg-secondary', label: 'Healthy' },
    degraded: { color: 'bg-warning', label: 'Degraded' },
    unhealthy: { color: 'bg-error', label: 'Down' },
};

const ProviderRow = ({ name, data }) => {
    const status = statusConfig[data.health_status] || statusConfig.unhealthy;

    return (
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/50 last:border-0 hover:bg-surfaceHover/50 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full ${status.color} shrink-0`} />
                <div className="min-w-0">
                    <div className="font-medium text-sm capitalize truncate">{name}</div>
                    <div className="text-[11px] text-textMuted">Priority {Math.round(data.priority)}</div>
                </div>
            </div>
            <div className="flex items-center gap-5 text-right shrink-0">
                <div className="hidden sm:block">
                    <div className="text-xs font-mono font-medium">{data.avg_latency ? Math.round(data.avg_latency) + 'ms' : '—'}</div>
                    <div className="text-[10px] text-textMuted">latency</div>
                </div>
                <div className="hidden md:block">
                    <div className="text-xs font-mono font-medium">{Math.round(data.speed_score)}</div>
                    <div className="text-[10px] text-textMuted">speed</div>
                </div>
                <div>
                    <div className={`text-xs font-mono font-medium ${data.error_rate > 0.05 ? 'text-error' : ''}`}>
                        {(data.error_rate * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-textMuted">errors</div>
                </div>
            </div>
        </div>
    );
};

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="panel px-3 py-2 text-xs">
            <p className="text-textMuted mb-0.5">{label}</p>
            <p className="font-mono font-medium text-primary">${Number(payload[0].value).toFixed(4)}</p>
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
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="panel h-[108px]" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 panel h-[340px]" />
                    <div className="panel h-[340px]" />
                </div>
            </div>
        );
    }

    const chartData = stats.dailyCosts?.map(item => ({
        date: item.date.substring(5),
        cost: item.cost
    })) || [];

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Requests"
                    value={stats.totalRequests.toLocaleString()}
                    subValue="All time"
                    icon={Activity}
                    accentColor="bg-primary/10 text-primary"
                />
                <StatCard
                    title="Avg Latency"
                    value={`${Math.round(stats.avgLatency)}ms`}
                    subValue="Global average"
                    icon={Zap}
                    accentColor="bg-warning/10 text-warning"
                />
                <StatCard
                    title="Total Cost"
                    value={`$${stats.totalCost.toFixed(4)}`}
                    subValue="Estimated USD"
                    icon={DollarSign}
                    accentColor="bg-secondary/10 text-secondary"
                />
                <StatCard
                    title="Active Providers"
                    value={stats.activeProviders}
                    subValue={`of ${stats.configuredProviders} configured`}
                    icon={Server}
                    accentColor="bg-primary/10 text-primary"
                />
            </div>

            {/* Charts + Provider Health */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Cost Chart */}
                <div className="lg:col-span-2 panel p-5">
                    <div className="flex items-center gap-2 mb-5">
                        <TrendingUp size={16} className="text-textMuted" />
                        <h3 className="font-semibold text-sm">Cost History</h3>
                        <span className="text-[11px] text-textMuted ml-auto">Last 7 days</span>
                    </div>
                    <div className="h-[250px] -ml-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#E5A84B" stopOpacity={0.15} />
                                        <stop offset="100%" stopColor="#E5A84B" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="date"
                                    stroke="#3a3a46"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: '#6B6A72' }}
                                />
                                <YAxis
                                    stroke="#3a3a46"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: '#6B6A72' }}
                                    tickFormatter={v => `$${v}`}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="cost"
                                    stroke="#E5A84B"
                                    strokeWidth={2}
                                    fill="url(#costGrad)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Provider Health */}
                <div className="panel overflow-hidden flex flex-col">
                    <div className="px-4 py-4 border-b border-border">
                        <div className="flex items-center gap-2">
                            <Server size={15} className="text-textMuted" />
                            <h3 className="font-semibold text-sm">Provider Health</h3>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {Object.entries(providers)
                            .filter(([, data]) => data.configured)
                            .sort(([, a], [, b]) => b.priority - a.priority)
                            .map(([name, data]) => (
                                <ProviderRow key={name} name={name} data={data} />
                            ))}
                        {Object.keys(providers).length === 0 && (
                            <div className="p-8 text-center text-textMuted text-sm">No providers configured</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
