/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#111113',
                surface: '#1a1a1f',
                surfaceHover: '#222228',
                surfaceHighlight: '#2a2a32',
                border: '#2e2e38',
                borderLight: '#3a3a46',
                primary: '#E5A84B',
                primaryMuted: '#C4903A',
                secondary: '#7FB685',
                error: '#E05C6C',
                warning: '#D4943A',
                text: '#E8E6E3',
                textSecondary: '#9B9AA0',
                textMuted: '#6B6A72',
            },
            fontFamily: {
                sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
            },
            borderRadius: {
                '2xl': '1rem',
                '3xl': '1.25rem',
            },
            boxShadow: {
                glow: '0 0 20px -5px rgba(229, 168, 75, 0.15)',
                panel: '0 1px 3px 0 rgba(0,0,0,0.3), 0 1px 2px -1px rgba(0,0,0,0.3)',
                elevated: '0 4px 24px -4px rgba(0,0,0,0.5)',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-down': 'slideDown 0.2s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideDown: {
                    '0%': { opacity: '0', transform: 'translateY(-8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
}
