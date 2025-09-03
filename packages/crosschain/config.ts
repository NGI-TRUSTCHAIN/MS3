import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env file
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });


// API Keys and Configuration
export const LIFI_API_KEY = process.env.LIFI_API_KEY || '';
export const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || '';
export const INFURA_API_KEY = process.env.INFURA_API_KEY || '';

// Feature flags for tests
export const RUN_INTEGRATION = process.env.RUN_INTEGRATION === 'true';

// Test-specific constants
export const TEST_MATIC_AMOUNT = '0.01';
export const DEFAULT_TEST_TIMEOUT = 30000;
export const QUOTE_TEST_TIMEOUT = 90 * 1000;
export const SWAP_EXECUTION_TIMEOUT = 600 * 1000;
export const BRIDGE_TIMEOUT = 1800 * 1000;

// Test function to verify if .env is loading correctly
export function verifyDotEnvLoading() {
  console.debug('[Crosschain Config] TEST_PRIVATE_KEY loaded:', TEST_PRIVATE_KEY ? 'YES ✅' : 'NO ❌');
  console.debug('[Crosschain Config] LIFI_API_KEY loaded:', LIFI_API_KEY ? 'YES ✅' : 'NO ❌');
  console.debug('[Crosschain Config] INFURA_API_KEY loaded:', INFURA_API_KEY ? 'YES ✅' : 'NO ❌');
  console.debug('[Crosschain Config] RUN_INTEGRATION:', RUN_INTEGRATION);
}

// Optional: Run verification during module load for quick feedback during development
verifyDotEnvLoading();