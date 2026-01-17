import React, { useState } from 'react';
import api from '../api';
import { Send, Terminal, AlertCircle } from 'lucide-react';

export default function Playground() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [selectedProvider, setSelectedProvider] = useState('');
    const [loading, setLoading] = useState(false);

    const providers = [
        'openai', 'anthropic', 'google', 'mistral', 'groq', 'together', 'fireworks', 'nvidia', 'deepseek', 'openrouter'
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // We use the wrapper's own API here!
            // We need a wrapper API Key usually, but for admin playground we might use the admin token?
            // Actually, server.js /v1/chat/completions requires verifyWrapperKey (Bearer sk-...)
            // But we are ALREADY logged in as Admin. 
            // PROBLEM: /v1/chat/completions checks verifyWrapperKey, NOT verifyToken (JWT).
            // Solution: We should create a special "internal" key or just generate one temporarily?
            // OR: We update server.js to allow Admin JWT on chat route too?
            // Easier: Just use one of the client keys we generated?
            // For now, let's assume the user has to pick a "Test Key" or we allow Admin JWT bypass.
            // Let's rely on Admin JWT bypass which I will add to server.js shortly, OR just use valid key.
            // Actually, let's just make the UI ask for a wrapper key if needed, OR bypass.

            // I'll update server.js to allow JWT for testing.

            const res = await api.post('/v1/chat/completions', {
                model: 'gpt-3.5-turbo', // The wrapper will map this
                messages: [...messages, userMsg],
                stream: false
            }, {
                headers: {
                    'x-force-provider': selectedProvider || undefined
                },
                baseURL: import.meta.env.VITE_API_URL || '' // Override to root or explicit URL
            });

            const assistantMsg = res.data.choices[0].message;
            setMessages(prev => [...prev, assistantMsg]);
        } catch (error) {
            console.error(error);
            const errorMsg = { role: 'system', content: `Error: ${error.response?.data?.error || error.message}` };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold">System Playground</h2>
                    <p className="text-textDim">Directly test providers to verify connectivity and latency.</p>
                </div>
                <div className="flex items-center gap-2 bg-white/5 p-2 rounded-lg">
                    <span className="text-sm font-medium px-2">Force Provider:</span>
                    <select
                        className="bg-[#121212] text-white text-sm outline-none cursor-pointer border border-white/10 rounded px-2 py-1"
                        value={selectedProvider}
                        onChange={e => setSelectedProvider(e.target.value)}
                    >
                        <option value="" className="bg-[#121212]">Auto (Load Balanced)</option>
                        {providers.map(p => (
                            <option key={p} value={p} className="bg-[#121212]">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex-1 glass-panel flex flex-col overflow-hidden relative">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-textDim opacity-50">
                            <Terminal size={48} className="mb-4" />
                            <p>Send a message to test the routing logic.</p>
                        </div>
                    )}
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                ? 'bg-primary text-background font-medium'
                                : msg.role === 'system'
                                    ? 'bg-error/10 text-error border border-error/20'
                                    : 'bg-white/10'
                                }`}>
                                <div className="test-sm whitespace-pre-wrap">{msg.content}</div>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
                                <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" />
                                <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                                <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce [animation-delay:0.4s]" />
                            </div>
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 bg-surface/50 backdrop-blur-md">
                    <div className="relative">
                        <input
                            type="text"
                            className="input-field w-full pr-12"
                            placeholder="Type a message..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-white transition-colors disabled:opacity-50"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                    {!selectedProvider && (
                        <div className="text-xs text-textDim mt-2 flex items-center gap-1">
                            <AlertCircle size={12} /> Request will be routed dynamically based on speed & health.
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
