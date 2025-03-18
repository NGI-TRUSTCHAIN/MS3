#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get branch name from args
const branchName = process.argv[2];
if (!branchName || !branchName.startsWith('collaborate/adapter/')) {
  console.error('Invalid branch name format. Expected: collaborate/adapter/<adapter-name>');
  process.exit(1);
}

// Extract adapter name
const adapterName = branchName.split('/')[2];
console.log(`Validating adapter: ${adapterName}`);

// Check if adapter file exists
const adapterFilePath = path.join(__dirname, '..', 'packages/wallet/src/adapters', `${adapterName}Wallet.ts`);
if (!fs.existsSync(adapterFilePath)) {
  console.error(`Adapter file not found at: ${adapterFilePath}`);
  process.exit(1);
}

// Run TypeScript compiler to verify interface implementation
try {
  console.log('Running TypeScript compiler to validate interfaces...');
  execSync('npx tsc --noEmit', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('✅ TypeScript compilation successful - adapter implements required interfaces');
} catch (error) {
  console.error('❌ TypeScript compilation failed - check if adapter implements all required methods');
  process.exit(1);
}

// Run the dynamic validation test
try {
  console.log(`Running dynamic validation for ${adapterName}Wallet...`);
  
  // Extract the interface directly from the file content using regex
  const fileContent = fs.readFileSync(adapterFilePath, 'utf8');
  const implementsMatch = fileContent.match(/implements\s+(\w+)/);
  
  if (!implementsMatch) {
    console.error('❌ Could not detect interface implementation in adapter');
    process.exit(1);
  }
  
  // Extract the implemented interface name
  const interfaceName = implementsMatch[1];
  console.log(`Detected implementation of interface: ${interfaceName}`);
  
  // Set environment variables for the test
  process.env.ADAPTER_PATH = `packages/wallet/src/adapters/${adapterName}Wallet`;
  process.env.INTERFACE_NAME = interfaceName;
  
  // Run the test with the extracted interface information
  execSync('npx mocha -r ts-node/register tests/unit/wallet/adapters/adapterWallet.spec.ts', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: {...process.env}
  });
  
  console.log('✅ Dynamic validation passed');
} catch (error) {
  console.error('❌ Dynamic validation failed');
  process.exit(1);
}

console.log('✅ Adapter validation successful!');
process.exit(0);