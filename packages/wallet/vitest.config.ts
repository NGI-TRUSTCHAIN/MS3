import { defineConfig } from 'vitest/config';
import fs from 'fs';
import path from 'path';

const reportsDir = path.join(process.cwd(), 'reports');
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,

    reporters: [
      'default',
      ['junit', { outputFile: 'reports/junit-wallet.xml' }]
    ],

    sequence: {
      concurrent: false,
      shuffle: false,
    },
    testTimeout: 30000,
    hookTimeout: 10000,
  }
});
