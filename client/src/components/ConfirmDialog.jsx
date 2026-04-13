import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger', onConfirm, onCancel }) {
    if (!open) return null;

    const btnClass = variant === 'danger'
        ? 'bg-error text-white hover:brightness-110'
        : 'bg-primary text-background hover:brightness-110';

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={onCancel}>
            <div className="bg-surface border border-border rounded-2xl shadow-elevated w-full max-w-sm p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex items-start gap-3 mb-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        variant === 'danger' ? 'bg-error/10' : 'bg-primary/10'
                    }`}>
                        <AlertTriangle size={17} className={variant === 'danger' ? 'text-error' : 'text-primary'} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm mb-1">{title}</h3>
                        <p className="text-sm text-textSecondary leading-relaxed">{message}</p>
                    </div>
                </div>
                <div className="flex gap-2.5 mt-5">
                    <button
                        onClick={onConfirm}
                        className={`flex-1 text-sm font-semibold py-2.5 rounded-xl transition-all active:scale-[0.98] ${btnClass}`}
                    >
                        {confirmLabel}
                    </button>
                    <button
                        onClick={onCancel}
                        className="flex-1 text-sm font-medium py-2.5 rounded-xl bg-surfaceHover text-textSecondary hover:text-text transition-all active:scale-[0.98]"
                    >
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
