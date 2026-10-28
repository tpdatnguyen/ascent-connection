import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode single` inlines all JS and CSS into dist/index.html so the
// app can be published as a single-file claude.ai Artifact.
// JSX is compiled by esbuild directly (no React plugin needed).
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  esbuild: { jsx: 'automatic' },
  build: { target: 'es2020' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}));
