import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Tests live in server/test; keep root here regardless of caller cwd.
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: {
      // Shared types are imported as '@shared/types/index.js' at runtime in
      // dist; in tests resolve to the TS source.
      '@shared/types/index.js': fileURLToPath(new URL('../shared/types/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 20000,
  },
});
