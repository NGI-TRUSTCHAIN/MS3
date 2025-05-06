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
// console.debug('Loading environment variables from:', path.resolve(rootDir, '../.env'));

// Export environment variables
export const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || '';

// Test function to verify if .env is loading correctly
export function verifyDotEnvLoading() {
  // console.debug('TEST_PRIVATE_KEY found:', TEST_PRIVATE_KEY ? 'YES ✅' : 'NO ❌');
  // console.debug('TEST_PRIVATE_KEY preview:', TEST_PRIVATE_KEY ? `${TEST_PRIVATE_KEY.substring(0, 10)}...` : 'N/A');
}

/**
 * Gets the test private key from environment variables
 * @returns The private key to use for testing
 */
export function getTestPrivateKey() {
  // Get the private key from environment variables
  if (!TEST_PRIVATE_KEY) {
    console.warn('⚠️ TEST_PRIVATE_KEY environment variable not found! Using empty string.');
    return '';
  }
  return TEST_PRIVATE_KEY;
}

// Call the verification function when this module is loaded
verifyDotEnvLoading();