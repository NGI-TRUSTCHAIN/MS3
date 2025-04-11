import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Define packages to test in order
const packages = ['wallet', 'crosschain', 'smart-contract'];

// Get all packages or specific ones from command line args
const requestedPackages = process.argv.slice(2);
const packagesToTest = requestedPackages.length > 0 ? 
  requestedPackages : packages;

console.log(`Will test packages in this order: ${packagesToTest.join(', ')}`);

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
      failures.push(pkg);
      continue;
    }
    
    // Run the tests
    execSync(`cd packages/${pkg} && npm run test`, { stdio: 'inherit' });
    console.log(`\n✅ Tests passed for package: ${pkg}`);
  } catch (error) {
    console.error(`\n❌ Tests failed for package: ${pkg}`);
    failures.push(pkg);
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