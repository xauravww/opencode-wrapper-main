import React, { useState, useEffect, useRef } from 'react';
import api, { v1Api } from '../api';
import { Send, ChevronDown, Search, X, Trash2, Bot, User, Settings2 } from 'lucide-react';

function SearchableSelect({ value, onChange, options, placeholder, renderOption, emptyMessage }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        opt.value.toLowerCase().includes(search.toLowerCase())
    );

    const selectedOption = options.find(o => o.value === value);

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-surfaceHover hover:bg-surfaceHighlight text-sm border border-border rounded-xl px-3 py-2 min-w-[150px] justify-between transition-colors"
            >
                <span className="truncate flex-1 text-left text-textSecondary">
                    {selectedOption ? renderOption(selectedOption) : placeholder}
                </span>
                <ChevronDown size={13} className={`text-textMuted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1.5 w-full min-w-[220px] panel-elevated overflow-hidden">
                    <div className="p-2 border-b border-border">
                        <div className="flex items-center gap-2 bg-background rounded-lg px-2.5 py-2">
                            <Search size={13} className="text-textMuted" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search..."
                                className="bg-transparent text-sm text-text outline-none flex-1 placeholder-textMuted"
                                autoFocus
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="text-textMuted hover:text-text">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="py-1 max-h-[240px] overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="p-3 text-xs text-textMuted text-center">{emptyMessage || 'No options'}</div>
                        ) : (
                            filteredOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { onChange(opt.value); setIsOpen(false); setSearch(''); }}
                                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors truncate ${
                                        value === opt.value
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-textSecondary hover:bg-surfaceHover hover:text-text'
                                    }`}
                                >
                                    {renderOption(opt)}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function Playground() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [selectedProvider, setSelectedProvider] = useState('');
    const [loading, setLoading] = useState(false);
    const [providers, setProviders] = useState([]);
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [loadingModels, setLoadingModels] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => { fetchConfiguredData(); }, []);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const fetchConfiguredData = async () => {
        setLoadingModels(true);
        try {
            const statusRes = await api.get('/admin/providers');
            const providerData = statusRes.data || {};
            const configuredProviders = Object.keys(providerData).filter(key => providerData[key].configured);
            setProviders(configuredProviders);

            try {
                const modelsRes = await api.get('/v1/models', { baseURL: import.meta.env.VITE_API_URL || '' });
                if (modelsRes.data?.data) {
                    const modelOptions = modelsRes.data.data.map(m => ({ value: m.id, label: m.id, provider: m.provider }));
                    setModels(modelOptions);
                    if (modelOptions.length > 0) setSelectedModel(modelOptions[0].value);
                }
            } catch {
                const fallbackModels = [];
                configuredProviders.forEach(p => {
                    getDefaultModels(p).forEach(m => fallbackModels.push({ value: m, label: m, provider: p }));
                });
                setModels(fallbackModels);
                if (fallbackModels.length > 0) setSelectedModel(fallbackModels[0].value);
            }
        } catch (error) {
            console.error('Failed to fetch providers:', error);
        } finally {
            setLoadingModels(false);
        }
    };

    const getDefaultModels = (provider) => {
        const defaults = {
            openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
            anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
            google: ['gemini-1.5-pro', 'gemini-1.5-flash'],
            mistral: ['mistral-large-latest', 'mistral-small-latest'],
            groq: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
            together: ['meta-llama/Llama-3.3-70B-Instruct-Turbo'],
            deepseek: ['deepseek-chat', 'deepseek-coder'],
            nvidia: ['nvidia/llama-3.1-nemotron-70b-instruct'],
            opencode: ['minimax-m2.5-free', 'trinity-large-preview-free']
        };
        return defaults[provider] || [];
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await v1Api.post('/v1/chat/completions', {
                model: selectedModel || 'minimax-m2.5-free',
                messages: [...messages, userMsg],
                stream: false
            }, {
                headers: { 'x-force-provider': models.find(m => m.value === selectedModel)?.provider || undefined }
            });

            setMessages(prev => [...prev, { role: 'assistant', content: res.data.choices[0].message.content }]);
        } catch (error) {
            const errorContent = error.response?.data?.error
                ? (typeof error.response.data.error === 'object' ? JSON.stringify(error.response.data.error) : error.response.data.error)
                : error.message;
            setMessages(prev => [...prev, { role: 'error', content: errorContent }]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
    };

    const clearChat = () => { setMessages([]); inputRef.current?.focus(); };

    const filteredModels = selectedProvider ? models.filter(m => m.provider === selectedProvider) : models;
    const providerOptions = [
        { value: '', label: 'Auto' },
        ...providers.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] lg:h-[calc(100vh-theme(spacing.8))] -m-4 sm:-m-6 lg:-m-8">
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-surface/60 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Bot size={16} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold">Playground</h1>
                        <p className="text-[11px] text-textMuted hidden sm:block">Test your AI endpoints</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-xl transition-colors ${showSettings ? 'bg-primary/10 text-primary' : 'text-textMuted hover:text-text hover:bg-surfaceHover'}`}
                    >
                        <Settings2 size={16} />
                    </button>
                    {messages.length > 0 && (
                        <button onClick={clearChat} className="p-2 rounded-xl text-textMuted hover:text-error hover:bg-error/5 transition-colors">
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Settings */}
            {showSettings && (
                <div className="px-4 sm:px-6 py-3 border-b border-border bg-surface/40 flex items-center gap-3 flex-wrap shrink-0 animate-slide-down">
                    <SearchableSelect
                        value={selectedModel}
                        onChange={setSelectedModel}
                        options={filteredModels}
                        placeholder={loadingModels ? "Loading..." : "Select model"}
                        renderOption={opt => (
                            <span className="flex items-center gap-2">
                                <span className="truncate">{opt.label}</span>
                                {opt.provider && <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">{opt.provider}</span>}
                            </span>
                        )}
                        emptyMessage="No models found"
                    />
                    <SearchableSelect
                        value={selectedProvider}
                        onChange={val => {
                            setSelectedProvider(val);
                            const pm = models.filter(m => m.provider === val);
                            if (pm.length > 0) setSelectedModel(pm[0].value);
                            else {
                                const defaults = getDefaultModels(val);
                                if (defaults.length > 0) setSelectedModel(defaults[0]);
                            }
                        }}
                        options={providerOptions}
                        placeholder="Provider"
                        renderOption={opt => opt.label}
                        emptyMessage="No providers"
                    />
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
                <div className="max-w-3xl mx-auto space-y-5">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                            <div className="w-14 h-14 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center mb-4">
                                <Bot size={26} className="text-primary" />
                            </div>
                            <h2 className="text-lg font-semibold mb-1.5">How can I help?</h2>
                            <p className="text-sm text-textSecondary max-w-sm">
                                Send a message to test your configured AI providers. Use settings to pick a specific model.
                            </p>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                msg.role === 'user' ? 'bg-primary/15' : msg.role === 'error' ? 'bg-error/15' : 'bg-surfaceHighlight'
                            }`}>
                                {msg.role === 'user' ? (
                                    <User size={14} className="text-primary" />
                                ) : msg.role === 'error' ? (
                                    <X size={14} className="text-error" />
                                ) : (
                                    <Bot size={14} className="text-textSecondary" />
                                )}
                            </div>
                            <div className={`flex-1 max-w-[85%] sm:max-w-[75%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                                <div className={`inline-block px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                                    msg.role === 'user'
                                        ? 'bg-primary/15 text-text rounded-tr-md'
                                        : msg.role === 'error'
                                            ? 'bg-error/8 text-error border border-error/15 rounded-tl-md'
                                            : 'bg-surfaceHover text-text rounded-tl-md'
                                }`}>
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex gap-3">
                            <div className="w-7 h-7 rounded-lg bg-surfaceHighlight flex items-center justify-center">
                                <Bot size={14} className="text-textSecondary" />
                            </div>
                            <div className="bg-surfaceHover px-4 py-3 rounded-2xl rounded-tl-md">
                                <div className="flex gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input */}
            <div className="px-4 sm:px-6 pb-4 pt-2 shrink-0">
                <div className="max-w-3xl mx-auto">
                    <form onSubmit={handleSubmit} className="relative">
                        <div className="flex items-end bg-surface border border-border rounded-2xl focus-within:border-borderLight transition-colors">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Send a message..."
                                rows={1}
                                className="flex-1 bg-transparent text-text text-sm px-4 py-3 pr-12 resize-none outline-none max-h-40 placeholder-textMuted"
                                style={{ minHeight: '48px' }}
                            />
                            <button
                                type="submit"
                                disabled={loading || !input.trim()}
                                className="absolute right-2.5 bottom-2.5 p-2 bg-primary hover:brightness-110 disabled:bg-surfaceHighlight disabled:cursor-not-allowed rounded-xl transition-all"
                            >
                                <Send size={14} className={loading || !input.trim() ? 'text-textMuted' : 'text-background'} />
                            </button>
                        </div>
                        <p className="text-center mt-2 text-[11px] text-textMuted">
                            {!selectedProvider ? 'Auto-routing' : `Provider: ${selectedProvider}`}
                            {selectedModel && <> &middot; {selectedModel}</>}
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
