import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const PORT = parseInt(process.env.VITE_PORT || '5173', 10);

export default defineConfig({
  plugins: [react()],
  server: {
    port: PORT,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
