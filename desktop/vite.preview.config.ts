import { defineConfig } from 'vite';

// Builds preview.html only, to look at the widget without Tauri (npm run preview:build).
export default defineConfig({
  build: { outDir: 'dist-preview', emptyOutDir: true, rollupOptions: { input: 'preview.html' } },
});
