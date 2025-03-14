import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import * as glob from 'glob';

// Get directory name in ESM
const __dirname = dirname(fileURLToPath(import.meta.url));

// Allow filtering by module
const moduleFilter = process.argv[2] || '*'; // Default to all modules

// Find test files for the specified module
const files = glob.sync(`unit/${moduleFilter}/**/*.spec.ts`, { cwd: __dirname });
console.log(`Found ${files.length} test files for module "${moduleFilter}":`, files);

if (files.length === 0) {
  console.error(`No test files found for module "${moduleFilter}"`);
  process.exit(1);
}

// Convert file paths to absolute paths
const testPaths = files.map(file => resolve(__dirname, file));

// Run tests
const mochaProcess = spawn('node', [
  '--no-warnings',
  '--loader=ts-node/esm',
  '--experimental-specifier-resolution=node',
  join(__dirname, 'node_modules', 'mocha', 'bin', 'mocha.js'),
  '--timeout', '60000',
  ...testPaths
], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    TS_NODE_PROJECT: join(__dirname, 'tsconfig.json'),
    TS_NODE_TRANSPILE_ONLY: 'true'
  }
});

mochaProcess.on('close', code => {
  process.exit(code);
});