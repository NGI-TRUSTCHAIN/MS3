import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import {logger} from '../logger.js';
import { Ms3Modules } from '@m3s/shared';

// Define packages to test in order
const packages = [Ms3Modules.wallet, Ms3Modules.smartcontract, Ms3Modules.crosschain];
const requestedPackages = process.argv.slice(2);
const packagesToTest = requestedPackages.length > 0 ? requestedPackages : packages;

logger.notice(`Will test packages in this order: ${packagesToTest.join(', ')}`);
logger.info("ℹ️ Tests will run sequentially. The script will stop on the first package failure.");

let failures: string[] = []

// Run tests for each package sequentially
for (const pkg of packagesToTest) {
  logger.notice(`========== Testing package: ${pkg} ==========`);

  try {
    // Verify the package exists
    const packageDir = path.join(process.cwd(), 'packages', pkg);
    if (!fs.existsSync(packageDir)) {
      logger.crit(`❌ Package directory not found: ${packageDir}`);
      logger.emerg(`🚨 Halting test execution due to missing package: ${pkg}.`);
      process.exit(1);
    }

    logger.info(`[${pkg}] Executing tests with: npm run test -- --run --sequence.sequential`);
    execSync(`cd packages/${pkg} && npm run test -- --run --sequence.sequential`, { stdio: 'inherit' });
    logger.notice(`✅ Tests passed for package: ${pkg}`);
  } catch (error) {
    logger.error(`❌ Tests FAILED for package: ${pkg}`);
    logger.emerg(`🚨 Halting test execution due to failure in package: ${pkg}.`);
    process.exit(1);
  }
}

// Report results
logger.notice('========== Test Summary ==========');
if (failures.length === 0) {
  logger.notice('✅ All packages tested successfully!');
} else {
  logger.error(`❌ Tests failed for ${failures.length} package(s): ${failures.join(', ')}`);
  process.exit(1);
}