/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#0a0a0a',
                surface: '#121212',
                surfaceHighlight: '#1E1E1E',
                primary: '#00D1FF', // Neon Blue
                secondary: '#00FF94', // Neon Green
                error: '#FF0055', // Neon Red
                warning: '#FFB800',
                text: '#EDEDED',
                textDim: '#A1A1A1'
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
