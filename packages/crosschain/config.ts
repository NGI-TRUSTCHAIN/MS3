import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to root directory (one level up from the package directory)
const rootDir = path.resolve(__dirname, '..');

// Load .env from the root directory (one level up from packages)
const envPath = path.resolve(rootDir, '../.env');
dotenv.config({ path: envPath });

// Debug output to verify path
console.log('Crosschain config loading environment variables from:', envPath);
console.log('TEST_PRIVATE_KEY found:', process.env.TEST_PRIVATE_KEY ? 'YES ✅' : 'NO ❌');
console.log('LIFI_API_KEY found:', process.env.LIFI_API_KEY ? 'YES ✅' : 'NO ❌');

// Export environment variables
export const LIFI_API_KEY = process.env.LIFI_API_KEY || '';
export const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || '';
// IMPORTANT: Higher timeout values for long-running tests
export const DEFAULT_TEST_TIMEOUT = 15000; // 15 seconds
// Set to true only when you want to test actual MATIC transfer
export const RUN_REAL_EXECUTION = process.env.RUN_REAL_EXECUTION === 'true';
// Use a very small amount to not waste MATIC
export const TEST_MATIC_AMOUNT = '0.0001';
export const QUOTE_TEST_TIMEOUT = 90 * 1000; // 90 seconds