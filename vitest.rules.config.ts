import { defineConfig } from 'vitest/config';

// Security-rules tests. Run with `npm run test:rules` (starts the Firestore emulator; needs Java 21).
export default defineConfig({
  test: { environment: 'node', include: ['tests/rules/**/*.test.ts'], testTimeout: 20000, hookTimeout: 30000, fileParallelism: false },
});
