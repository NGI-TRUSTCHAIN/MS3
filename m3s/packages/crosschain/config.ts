import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env file
// Path is now relative to packages/crosschain/config.ts (up two levels to monorepo root)
const envPath = path.resolve(__dirname, '../../.env');
// console.debug(`Crosschain config loading environment variables from: ${envPath}`);
dotenv.config({ path: envPath });

// API Keys and Configuration
export const LIFI_API_KEY = process.env.LIFI_API_KEY || '';
export const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || '';
export const INFURA_API_KEY = process.env.INFURA_API_KEY || ''; // Added for test RPCs

// Feature flags for tests
export const RUN_REAL_EXECUTION = process.env.RUN_REAL_EXECUTION === 'true'; // Using a more specific env var name

// Test-specific constants
export const TEST_MATIC_AMOUNT = '0.01'; // Example amount.
export const DEFAULT_TEST_TIMEOUT = 30000; // 30 seconds, increased from previous.
export const QUOTE_TEST_TIMEOUT = 90 * 1000; // 90 seconds for potentially slow quote APIs.
export const SWAP_EXECUTION_TIMEOUT = 600 * 1000; // 10 minutes for same-chain swaps.
export const BRIDGE_TIMEOUT = 1800 * 1000; // 30 minutes for cross-chain bridge operations.

// Test function to verify if .env is loading correctly
export function verifyDotEnvLoading() {
  console.debug('[Crosschain Config] TEST_PRIVATE_KEY loaded:', TEST_PRIVATE_KEY ? 'YES ✅' : 'NO ❌');
  console.debug('[Crosschain Config] LIFI_API_KEY loaded:', LIFI_API_KEY ? 'YES ✅' : 'NO ❌');
  console.debug('[Crosschain Config] INFURA_API_KEY loaded:', INFURA_API_KEY ? 'YES ✅' : 'NO ❌');
  console.debug('[Crosschain Config] RUN_REAL_EXECUTION:', RUN_REAL_EXECUTION);
}

// Optional: Run verification during module load for quick feedback during development
// verifyDotEnvLoading();