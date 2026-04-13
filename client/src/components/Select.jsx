import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function Select({ value, onChange, options, placeholder = 'Select...', className = '' }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selected = options.find(o => o.value === value);

    return (
        <div className={`relative ${className}`} ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between gap-2 bg-background border border-border rounded-xl px-4 py-2.5 text-sm transition-colors hover:border-borderLight"
            >
                <span className={selected ? 'text-text' : 'text-textMuted'}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDown size={14} className={`text-textMuted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-50 mt-1.5 w-full bg-surface border border-border rounded-xl shadow-elevated overflow-hidden animate-slide-down">
                    <div className="py-1 max-h-[220px] overflow-y-auto">
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => { onChange(opt.value); setOpen(false); }}
                                className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors ${
                                    value === opt.value
                                        ? 'bg-primary/8 text-primary'
                                        : 'text-textSecondary hover:bg-surfaceHover hover:text-text'
                                }`}
                            >
                                <span>{opt.label}</span>
                                {value === opt.value && <Check size={13} className="text-primary" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
