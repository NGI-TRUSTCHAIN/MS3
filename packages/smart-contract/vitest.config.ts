import { defineConfig } from 'vitest/config';
import { BaseSequencer } from 'vitest/node';
import fs from 'fs';
import path from 'path';

// ...existing code...
const reportsDir = path.join(process.cwd(), 'reports');
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    // Add this line to restrict Vitest to a single thread
    maxWorkers: 1,
    minWorkers: 1,

    // add reporters so Vitest emits JUnit XML for Azure
    reporters: [
      'default',
      ['junit', { outputFile: 'reports/junit-smart-contract.xml' }]
    ],

    sequence: {
      sequencer: BaseSequencer,
      shuffle: false,
      concurrent: false, // For test.concurrent() within a file
      hooks: 'stack',
    },

    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/artifacts/**',
      '**/cache/**',
      '**/logs/**',
      '**/tmp/**',
      '**/temp/**'
    ],

    // ensure watch is off for CI-like runs
    watch: false
  }
});
