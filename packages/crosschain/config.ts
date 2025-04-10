import dotenv from 'dotenv';

dotenv.config();

export const LIFI_API_KEY = process.env.LIFI_API_KEY || '';
export const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || '';
// IMPORTANT: Higher timeout values for long-running tests
export const DEFAULT_TEST_TIMEOUT = 15000; // 15 seconds
// Set to true only when you want to test actual MATIC transfer
export const RUN_REAL_EXECUTION = process.env.RUN_REAL_EXECUTION === 'true';
// Use a very small amount to not waste MATIC
export const TEST_MATIC_AMOUNT = '0.0001';
export const QUOTE_TEST_TIMEOUT = 90 * 1000; // 90 seconds