import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url'; // <<< Import necessary modules

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env file
// Calculate path relative to this file: up from src, crosschain, packages to root
const envPath = path.resolve(__dirname, '../../../.env');
console.log(`Crosschain config loading environment variables from: ${envPath}`); // <<< Log the calculated path
dotenv.config({ path: envPath }); // <<< Use the calculated path

// API Keys and Configuration
export const LIFI_API_KEY = process.env.LIFI_API_KEY || '';
export const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || '';

// Test function to verify if .env is loading correctly
export function verifyDotEnvLoading() {
  console.log('TEST_PRIVATE_KEY found:', TEST_PRIVATE_KEY ? 'YES ✅' : 'NO ❌');
  console.log('LIFI_API_KEY found:', LIFI_API_KEY ? 'YES ✅' : 'NO ❌');
}

// Run verification during module load (optional, for debugging)
// verifyDotEnvLoading();

// IMPORTANT: Higher timeout values for long-running tests
// ... rest of the file
export const DEFAULT_TEST_TIMEOUT = 15000; // 15 seconds
// Set to true only when you want to test actual MATIC transfer
export const RUN_REAL_EXECUTION = process.env.RUN_REAL_EXECUTION === 'true';
// Use a very small amount to not waste MATIC
export const TEST_MATIC_AMOUNT = '0.0001';
export const QUOTE_TEST_TIMEOUT = 90 * 1000; // 90 seconds