import React, { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose, duration = 3500 }) {
    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [message, duration, onClose]);

    if (!message) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[300] animate-slide-up">
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-elevated text-sm font-medium ${
                type === 'success'
                    ? 'bg-surface border-secondary/25 text-secondary'
                    : 'bg-surface border-error/25 text-error'
            }`}>
                {type === 'success' ? <CheckCircle size={15} /> : <XCircle size={15} />}
                <span>{message}</span>
                <button onClick={onClose} className="ml-1 p-0.5 opacity-50 hover:opacity-100 transition-opacity">
                    <X size={13} />
                </button>
            </div>
        </div>
    );
}
