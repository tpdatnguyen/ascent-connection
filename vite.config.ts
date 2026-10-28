import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode single` inlines all JS and CSS into dist/index.html so the
// app can be published as a single-file claude.ai Artifact.
// JSX is compiled by esbuild directly (no React plugin needed).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  esbuild: { jsx: 'automatic' },
  // The only large chunk is the lazily loaded Firebase SDK (~135 KB gzip), fetched only when
  // VITE_FIREBASE_* is set; the startup chunk stays ~60 KB gzip.
  build: { target: 'es2020', chunkSizeWarningLimit: 600 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
