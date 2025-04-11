import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to root directory (two levels up from the package directory)
const rootDir = path.resolve(__dirname, '..');

// Load .env from the root directory
dotenv.config({ path: path.resolve(rootDir, '../.env') });

// Debug output to troubleshoot
console.log('Loading environment variables from:', path.resolve(rootDir, '../.env'));

// Export environment variables
export const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || '';

// Test function to verify if .env is loading correctly
export function verifyDotEnvLoading() {
  console.log('TEST_PRIVATE_KEY found:', TEST_PRIVATE_KEY ? 'YES ✅' : 'NO ❌');
  console.log('TEST_PRIVATE_KEY preview:', TEST_PRIVATE_KEY ? `${TEST_PRIVATE_KEY.substring(0, 10)}...` : 'N/A');
}

// Call the verification function when this module is loaded
verifyDotEnvLoading();