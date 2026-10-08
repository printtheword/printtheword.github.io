/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  // GitHub Pages serves the site under /<repo>/
  base: process.env.BASE_PATH ?? './',
  plugins: [solid()],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: 'index.html', impressum: 'impressum.html' } },
  },
  test: { environment: 'node' },
});
