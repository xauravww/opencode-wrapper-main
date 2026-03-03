import React, { useState, useEffect, useRef } from 'react';
import api, { v1Api } from '../api';
import { Send, Plus, ChevronDown, Search, X, Trash2, Loader2, Bot, User, Settings2 } from 'lucide-react';

function SearchableSelect({ value, onChange, options, placeholder, renderOption, emptyMessage, icon: Icon }) {
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
                className="flex items-center gap-2 bg-[#2a2a2a] hover:bg-[#333] text-white text-sm border border-[#404040] rounded-lg px-3 py-2 min-w-[160px] justify-between transition-colors"
            >
                {Icon && <Icon size={14} className="text-[#10a37f]" />}
                <span className="truncate flex-1 text-left">
                    {selectedOption ? renderOption(selectedOption) : placeholder}
                </span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[220px] bg-[#1a1a1a] border border-[#404040] rounded-lg shadow-2xl overflow-hidden top-full">
                    <div className="p-2 border-b border-[#333]">
                        <div className="flex items-center gap-2 bg-[#2a2a2a] rounded-lg px-3 py-2">
                            <Search size={14} className="text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search..."
                                className="bg-transparent text-sm text-white outline-none flex-1 placeholder-gray-500"
                                autoFocus
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="hover:text-white">
                                    <X size={14} className="text-gray-400" />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="py-1">
                        {filteredOptions.length === 0 ? (
                            <div className="p-3 text-sm text-gray-500 text-center">{emptyMessage || 'No options'}</div>
                        ) : (
                            filteredOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-[#2a2a2a] transition-colors whitespace-nowrap overflow-hidden text-ellipsis ${
                                        value === opt.value ? 'bg-[#10a37f]/15 text-[#10a37f]' : 'text-gray-200'
                                    }`}
                                >
                                    <span className="block truncate">{renderOption(opt)}</span>
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

    useEffect(() => {
        fetchConfiguredData();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchConfiguredData = async () => {
        setLoadingModels(true);
        try {
            const statusRes = await api.get('/admin/providers');
            const providerData = statusRes.data || {};
            
            const configuredProviders = Object.keys(providerData).filter(
                key => providerData[key].configured
            );
            setProviders(configuredProviders);

            try {
                const modelsRes = await api.get('/v1/models', {
                    baseURL: import.meta.env.VITE_API_URL || ''
                });
                
                if (modelsRes.data && modelsRes.data.data) {
                    const modelOptions = modelsRes.data.data.map(m => ({
                        value: m.id,
                        label: m.id,
                        provider: m.provider
                    }));
                    setModels(modelOptions);
                    
                    if (modelOptions.length > 0) {
                        setSelectedModel(modelOptions[0].value);
                    }
                }
            } catch (modelErr) {
                const fallbackModels = [];
                configuredProviders.forEach(p => {
                    const defaults = getDefaultModels(p);
                    defaults.forEach(m => fallbackModels.push({ value: m, label: m, provider: p }));
                });
                setModels(fallbackModels);
                if (fallbackModels.length > 0) {
                    setSelectedModel(fallbackModels[0].value);
                }
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
            together: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
            deepseek: ['deepseek-chat', 'deepseek-coder'],
            nvidia: ['nvidia/llama-3.1-nemotron-70b-instruct'],
            opencode: ['minimax-m2.5-free', 'trinity-large-preview-free', 'grok-code']
        };
        return defaults[provider] || [];
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        const currentInput = input;
        setInput('');
        setLoading(true);

        try {
            const res = await v1Api.post('/v1/chat/completions', {
                model: selectedModel || 'minimax-m2.5-free',
                messages: [...messages, userMsg],
                stream: false
            }, {
                headers: {
                    'x-force-provider': (models.find(m => m.value === selectedModel)?.provider) || undefined
                }
            });

            const assistantMsg = { role: 'assistant', content: res.data.choices[0].message.content };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (error) {
            console.error(error);
            const errorContent = error.response?.data?.error ? 
                (typeof error.response.data.error === 'object' ? JSON.stringify(error.response.data.error) : error.response.data.error) : 
                error.message;
            const errorMsg = { role: 'error', content: errorContent };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const clearChat = () => {
        setMessages([]);
        inputRef.current?.focus();
    };

    const filteredModels = selectedProvider 
        ? models.filter(m => m.provider === selectedProvider)
        : models;

    const providerOptions = [
        { value: '', label: 'Auto' },
        ...providers.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))
    ];

    return (
        <div className="min-h-screen flex flex-col bg-[#171717] -m-8">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-[#333] bg-[#1a1a1a] flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#10a37f] rounded-lg flex items-center justify-center">
                        <Bot size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-white">Playground</h1>
                        <p className="text-xs text-gray-500">Test and debug your AI endpoints</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-[#10a37f]/20 text-[#10a37f]' : 'hover:bg-[#2a2a2a] text-gray-400 hover:text-white'}`}
                    >
                        <Settings2 size={18} />
                    </button>
                    {messages.length > 0 && (
                        <button
                            onClick={clearChat}
                            className="p-2 rounded-lg hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition-colors"
                            title="Clear chat"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="px-8 py-3 bg-[#1f1f1f] border-b border-[#333] flex items-center gap-4 flex-wrap flex-shrink-0">
                    <SearchableSelect
                        value={selectedModel}
                        onChange={setSelectedModel}
                        options={filteredModels}
                        placeholder={loadingModels ? "Loading..." : "Model"}
                        renderOption={opt => (
                            <span className="flex items-center gap-2">
                                <span>{opt.label}</span>
                                <span className="text-xs text-[#10a37f] bg-[#10a37f]/15 px-1.5 py-0.5 rounded">{opt.provider}</span>
                            </span>
                        )}
                        emptyMessage="No models found"
                    />
                    <SearchableSelect
                        value={selectedProvider}
                        onChange={val => {
                            setSelectedProvider(val);
                            const providerModels = models.filter(m => m.provider === val);
                            if (providerModels.length > 0) {
                                setSelectedModel(providerModels[0].value);
                            } else {
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

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
                <div className="max-w-3xl mx-auto space-y-6">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                            <div className="w-16 h-16 bg-[#10a37f]/10 rounded-2xl flex items-center justify-center mb-4">
                                <Bot size={32} className="text-[#10a37f]" />
                            </div>
                            <h2 className="text-2xl font-semibold text-white mb-2">How can I help you?</h2>
                            <p className="text-gray-500 max-w-md">
                                Send a message to test your configured AI providers. Select a specific model or provider from settings, or leave empty for automatic routing.
                            </p>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                msg.role === 'user' ? 'bg-[#10a37f]' : msg.role === 'error' ? 'bg-red-500' : 'bg-[#2a2a2a]'
                            }`}>
                                {msg.role === 'user' ? (
                                    <User size={16} className="text-white" />
                                ) : msg.role === 'error' ? (
                                    <X size={16} className="text-white" />
                                ) : (
                                    <Bot size={16} className="text-[#10a37f]" />
                                )}
                            </div>
                            <div className={`flex-1 max-w-[80%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                                <div className={`inline-block px-4 py-3 rounded-2xl whitespace-pre-wrap text-sm leading-relaxed ${
                                    msg.role === 'user' 
                                        ? 'bg-[#10a37f] text-white rounded-tr-md'
                                        : msg.role === 'error'
                                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                            : 'bg-[#2a2a2a] text-gray-100 rounded-tl-md'
                                }`}>
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] flex items-center justify-center">
                                <Bot size={16} className="text-[#10a37f]" />
                            </div>
                            <div className="bg-[#2a2a2a] px-4 py-3 rounded-2xl rounded-tl-md">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-[#10a37f] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-[#10a37f] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-[#10a37f] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="px-8 pb-8 pt-4">
                <div className="max-w-3xl mx-auto">
                    <form onSubmit={handleSubmit} className="relative">
                        <div className="flex items-center bg-[#2a2a2a] border border-[#404040] rounded-2xl focus-within:border-[#10a37f] transition-colors">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Send a message..."
                                rows={1}
                                className="flex-1 bg-transparent text-white px-4 py-3 pr-12 resize-none outline-none max-h-48 placeholder-gray-500"
                                style={{ minHeight: '52px' }}
                            />
                            <button
                                type="submit"
                                disabled={loading || !input.trim()}
                                className="absolute right-3 p-2 bg-[#10a37f] hover:bg-[#0d8c6d] disabled:bg-[#404040] disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center"
                            >
                                <Send size={16} className="text-white" />
                            </button>
                        </div>
                        <div className="text-center mt-2">
                            <p className="text-xs text-gray-600">
                                {!selectedProvider 
                                    ? 'Auto-routing based on speed & health' 
                                    : `Forced provider: ${selectedProvider}`} • Model: {selectedModel || 'default'}
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
