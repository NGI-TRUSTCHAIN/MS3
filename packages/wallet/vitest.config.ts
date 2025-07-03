import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
  
    sequence: {
      concurrent: false,
      shuffle: false,
    },
    testTimeout: 30000,
    hookTimeout: 10000,
  }
});