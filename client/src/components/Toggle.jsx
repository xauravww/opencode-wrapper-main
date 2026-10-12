import React from 'react';

export default function Toggle({ checked, onChange, disabled = false, title }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            title={title}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
                checked ? 'bg-secondary' : 'bg-surfaceHighlight'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                    checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`}
            />
        </button>
    );
}
