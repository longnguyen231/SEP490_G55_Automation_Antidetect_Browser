import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vite Configuration
 * SEP490 G55 - Automation Antidetect Browser
 */
export default defineConfig({
    plugins: [react()],

    // Thư mục gốc cho source files
    root: path.join(__dirname, 'src/renderer'),

    // Output directory
    build: {
        outDir: path.join(__dirname, 'dist'),
        emptyOutDir: true,
    },

    // Development server
    server: {
        port: 5173,
        strictPort: true,
    },

    // Resolve aliases
    resolve: {
        alias: {
            '@': path.join(__dirname, 'src/renderer'),
            '@components': path.join(__dirname, 'src/renderer/components'),
            '@pages': path.join(__dirname, 'src/renderer/pages'),
            '@hooks': path.join(__dirname, 'src/renderer/hooks'),
            '@styles': path.join(__dirname, 'src/renderer/styles'),
        },
    },
});
