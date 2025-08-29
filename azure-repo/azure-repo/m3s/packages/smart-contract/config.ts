import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to root directory (one level up from the package directory)
const rootDir = path.resolve(__dirname, '..');

// Load .env from the root directory
dotenv.config({ path: path.resolve(rootDir, '../../.env') });

// Export environment variables
export const LIFI_API_KEY = process.env.LIFI_API_KEY
export const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY
export const RUN_INTEGRATION = process.env.RUN_INTEGRATION === 'true';
export const INFURA_API_KEY = process.env.INFURA_API_KEY
export const ALCHEMY_API_KEY =process.env.ALCHEMY_API_KEY

// Test function to verify if .env is loading correctly
export function verifyDotEnvLoading() {
  console.debug('TEST_PRIVATE_KEY found:', TEST_PRIVATE_KEY ? 'YES ✅' : 'NO ❌');
  console.debug('TEST_PRIVATE_KEY preview:', TEST_PRIVATE_KEY ? `${TEST_PRIVATE_KEY.substring(0, 10)}...` : 'N/A');
  console.debug('RUN_INTEGRATION:', RUN_INTEGRATION);
  console.debug('INFURA API KEY:', INFURA_API_KEY ? 'YES ✅' : 'NO ❌')
}

// Call the verification function when this module is loaded
verifyDotEnvLoading();