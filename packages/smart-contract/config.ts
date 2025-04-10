import dotenv from 'dotenv';

dotenv.config();

export const LIFI_API_KEY = process.env.LIFI_API_KEY || '';
export const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || '';
export const RUN_INTEGRATION_TESTS =  process.env.RUN_SC_INTEGRATION_TESTS|| true;