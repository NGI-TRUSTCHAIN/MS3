import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/tests/**/*.test.ts'],
    globals: true,

    // Longer timeouts for integration tests
    testTimeout: 300000, // 5 minutes
    hookTimeout: 300000, // 5 minutes
    
    // Other global settings
    sequence: {
      concurrent: false, // Run tests in sequence within files
    },
    
    // Conditionally run only specified tests
    typecheck: {
      enabled: false, // Disable typechecking for faster runs
    }
  }
});