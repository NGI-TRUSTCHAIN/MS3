import { defineConfig } from 'vitest/config';
import { BaseSequencer } from 'vitest/node'; // Import BaseSequencer

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    // Add this line to restrict Vitest to a single thread
    maxWorkers: 1,
    minWorkers: 1,
    sequence: {
      sequencer: BaseSequencer,
      shuffle: false,
      concurrent: false, // For test.concurrent() within a file
      hooks: 'stack',
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/artifacts/**', // ✅ Ignore contract compilation directories,
      '**/cache/**',     // ✅ Ignore cache directories
      '**/logs/**',      // ✅ Ignore log files
      '**/tmp/**',       // ✅ Ignore temp directories
      '**/temp/**'       // ✅ Ignore temp directories
    ],
    // ensure watch is off for CI-like runs
    watch: false
  }
});