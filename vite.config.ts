import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Quan trọng: Giúp chạy đúng trên GitHub Pages (subpath /thithutructuyenthayphat/)
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
