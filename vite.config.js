import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  root: './frontend',
  server: {
    port: 8000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  }
});
