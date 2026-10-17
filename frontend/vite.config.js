import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy all /api requests to the Express backend during development
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        // SSE connections need special handling — do not buffer
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Forward SSE headers without buffering
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['x-accel-buffering'] = 'no';
            }
          });
        },
      },
    },
  },
});
