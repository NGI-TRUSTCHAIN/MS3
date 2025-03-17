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

// Check if registration file exists
const regFilePath = path.join(__dirname, '..', 'packages/wallet/src/adapters', `${adapterName}Wallet.registration.ts`);
if (!fs.existsSync(regFilePath)) {
  console.error(`Registration file not found at: ${regFilePath}`);
  console.error(`Please create a registration file that adds your adapter to the registry.`);
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

// Check if unit tests exist for adapter
const testPath = path.join(__dirname, '..', 'tests/unit/wallet/adapters', `${adapterName}Wallet.spec.ts`);
if (!fs.existsSync(testPath)) {
  console.error(`❌ Unit tests not found at: ${testPath}`);
  console.error('Please add unit tests for your adapter');
  process.exit(1);
}

// Run unit tests for the adapter
try {
  console.log(`Running unit tests for ${adapterName}Wallet...`);
  execSync(`npx mocha -r ts-node/register tests/unit/wallet/adapters/${adapterName}Wallet.spec.ts`, { 
    stdio: 'inherit', 
    cwd: path.join(__dirname, '..') 
  });
  console.log('✅ Unit tests passed');
} catch (error) {
  console.error('❌ Unit tests failed');
  process.exit(1);
}

console.log('✅ Adapter validation successful!');
process.exit(0);