import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',   // bind to all interfaces so mobile on same LAN can connect
    port: 5173,
    proxy: {
      // Proxy only applies when VITE_API_URL is not set (laptop localhost mode).
      // When VITE_API_URL is set to a full URL (mobile LAN mode), axios bypasses
      // this proxy entirely and hits the backend directly.
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
