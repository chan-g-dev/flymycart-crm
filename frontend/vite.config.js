import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (command === 'build' && env.VITE_API_URL && (!/^https:\/\//.test(env.VITE_API_URL) || /^https:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(env.VITE_API_URL))) {
    throw new Error('Set VITE_API_URL to your HTTPS backend URL before building (or leave empty for a same-origin /api proxy).');
  }
  return {
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
  };
})
