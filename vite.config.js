import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(async ({ mode, command }) => {
  const isProd = command === 'build' || mode === 'production' || process.env.NODE_ENV === 'production';
  const rollupPlugins = [];
  if (isProd) {
    try {
      const { default: obfuscator } = await import('rollup-plugin-obfuscator');
      rollupPlugins.push(obfuscator({
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: true,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: false,
        renameGlobals: false,
        selfDefending: false,
        simplify: true,
        splitStrings: false,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayEncoding: ['rc4'],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 1,
        stringArrayWrappersChainedCalls: true,
        stringArrayWrappersType: 'variable',
        transformObjectKeys: false,
        unicodeEscapeSequence: false,
      }));
    } catch (e) {
      console.warn('Obfuscation plugin not installed, skipping:', e?.message || e);
    }
  }
  return {
    plugins: [react()],
    base: './',
    root: 'src/renderer',
    build: {
      outDir: '../../dist/renderer',
      emptyOutDir: true,
      rollupOptions: { plugins: rollupPlugins },
    },
    server: {
      port: 5173,
      watch: {
        // Ignore runtime data folder to reduce needless reloads
        ignored: [
          '**/data/**',
          '**/vendor/**',
        ],
      },
    },
  };
});
