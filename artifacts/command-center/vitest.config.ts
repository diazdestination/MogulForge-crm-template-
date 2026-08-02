import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Standalone vitest config: the app's vite.config.ts requires PORT/BASE_PATH
// env vars that are irrelevant for unit tests.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // The default 5s per-test timeout flakes when the suite runs alongside
    // other validation commands under CPU contention.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
