import React, { useState, useEffect } from 'react';
import api from '../api';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BadgeDollarSign, Users, Server } from 'lucide-react';

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

    const COLORS = ['#00D1FF', '#00FF94', '#FF0055', '#FFB000', '#9D00FF'];

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold">Usage Reports</h2>
                <p className="text-textDim">Breakdown of token usage and costs by client and provider.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Cost by Client */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Users size={18} className="text-primary" /> Cost by Client
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.costByClient} layout="vertical">
                                <XAxis type="number" stroke="#555" fontSize={12} tickFormatter={(value) => `$${value}`} />
                                <YAxis dataKey="client_name" type="category" stroke="#555" fontSize={12} width={100} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#121212', borderColor: '#333' }}
                                    formatter={(value) => [`$${Number(value).toFixed(6)}`, 'Total Cost']}
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                />
                                <Bar dataKey="total_cost" fill="#00D1FF" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Cost by Provider */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Server size={18} className="text-secondary" /> Cost by Provider
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.costByProvider}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="total_cost"
                                >
                                    {data.costByProvider.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#121212', borderColor: '#333' }}
                                    formatter={(value) => [`$${Number(value).toFixed(6)}`, 'Total Cost']}
                                />
                                <Legend verticalAlign="middle" align="right" layout="vertical" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="glass-panel overflow-hidden">
                <div className="p-4 border-b border-white/5">
                    <h3 className="font-bold flex items-center gap-2">
                        <BadgeDollarSign size={18} /> Detailed Client Usage
                    </h3>
                </div>
                <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-textDim uppercase text-xs">
                        <tr>
                            <th className="p-4 font-medium">Client Name</th>
                            <th className="p-4 font-medium text-right">Requests</th>
                            <th className="p-4 font-medium text-right">Tokens (Prompt)</th>
                            <th className="p-4 font-medium text-right">Tokens (Comp)</th>
                            <th className="p-4 font-medium text-right">Total Cost</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {data.costByClient.map((client, idx) => (
                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 font-medium">{client.client_name || 'System / Legacy'}</td>
                                <td className="p-4 text-right font-mono">{client.request_count}</td>
                                <td className="p-4 text-right font-mono text-textDim">{client.prompt_tokens?.toLocaleString()}</td>
                                <td className="p-4 text-right font-mono text-textDim">{client.completion_tokens?.toLocaleString()}</td>
                                <td className="p-4 text-right font-mono text-primary font-bold">
                                    ${client.total_cost?.toFixed(6)}
                                </td>
                            </tr>
                        ))}
                        {data.costByClient.length === 0 && !loading && (
                            <tr><td colSpan="5" className="p-8 text-center text-textDim">No data available.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
