import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const target = env.VITE_API_URL || 'http://localhost:3010';

    return {
        plugins: [react()],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        server: {
            proxy: {
                '/api': {
                    target: target,
                    changeOrigin: true,
                    secure: false,
                },
                '/v1': {
                    target: target,
                    changeOrigin: true,
                    secure: false,
                }
            }
        }
    }
})
