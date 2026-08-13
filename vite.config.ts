import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: './', // Quan trọng: Giúp chạy đúng trên GitHub Pages (subpath /thithutructuyenthayphat/)
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
