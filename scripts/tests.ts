import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Define packages to test in order
const packages = ['wallet', 'smart-contract', 'crosschain'];

// Get all packages or specific ones from command line args
const requestedPackages = process.argv.slice(2);
const packagesToTest = requestedPackages.length > 0 ?
  requestedPackages : packages;

console.log(`Will test packages in this order: ${packagesToTest.join(', ')}`);
console.log("ℹ️ Tests will run sequentially. The script will stop on the first package failure.");

// Track failures
let failures: string[] = [];

// Run tests for each package sequentially
for (const pkg of packagesToTest) {
  console.log(`\n\n========== Testing package: ${pkg} ==========\n`);

  try {
    // Verify the package exists
    const packageDir = path.join(process.cwd(), 'packages', pkg);
    if (!fs.existsSync(packageDir)) {
      console.error(`❌ Package directory not found: ${packageDir}`);
      console.error(`🚨 Halting test execution due to missing package: ${pkg}.`);
      process.exit(1); // Exit if a package directory doesn't exist
    }

    // Run the tests sequentially within the package
    // The '-- --run --sequence.sequential' passes these flags to the underlying vitest command
    // This assumes the 'test' script in each sub-package is 'vitest run' or similar.
    console.log(`[${pkg}] Executing tests with: npm run test -- --run --sequence.sequential`);
    execSync(`cd packages/${pkg} && npm run test -- --run --sequence.sequential`, { stdio: 'inherit' });
    console.log(`\n✅ Tests passed for package: ${pkg}`);
  } catch (error) {
    console.error(`\n❌ Tests FAILED for package: ${pkg}`);
    // The error from execSync (which includes Vitest's non-zero exit code) caused this catch.
    // Vitest should have already printed detailed error information to stderr (which is inherited).
    console.error(`🚨 Halting test execution due to failure in package: ${pkg}.`);
    process.exit(1); // Exit immediately on first failure
  }
}

// Report results
console.log('\n\n========== Test Summary ==========');
if (failures.length === 0) {
  console.log('✅ All packages tested successfully!');
} else {
  console.error(`❌ Tests failed for ${failures.length} package(s): ${failures.join(', ')}`);
  process.exit(1);
}