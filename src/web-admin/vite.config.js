import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react()
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Shared code aliases (relative to project root)
      '@shared': path.resolve(__dirname, '../shared'),
      '@components': path.resolve(__dirname, '../shared/components'),
      '@hooks': path.resolve(__dirname, '../shared/hooks'),
      '@services': path.resolve(__dirname, '../shared/services'),
      '@utils': path.resolve(__dirname, '../shared/utils'),
      '@styles': path.resolve(__dirname, '../shared/styles')
    }
  },
  server: {
    port: 5174,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
