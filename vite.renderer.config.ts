import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';

// Filter out preact:transform-hook-names — it requires 'zimmerframe' which only
// ships ESM exports, causing "No exports main defined" when loaded via CJS require().
const preactPlugins = (preact() as Plugin[]).filter(
  (p) => p.name !== 'preact:transform-hook-names',
);

// https://vitejs.dev/config
export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  plugins: preactPlugins,
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
