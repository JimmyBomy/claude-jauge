import { defineConfig } from 'vite';

// Tauri serves the built files from ../dist and talks to Vite on a fixed port in dev.
export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true, fs: { allow: ['..'] } },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    target: 'chrome110',
    sourcemap: false,
    outDir: 'dist',
    emptyOutDir: true,
  },
});
