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

// Read the registration file to determine adapter type
try {
  const regContent = fs.readFileSync(regFilePath, 'utf-8');
  const adapterTypeMatch = regContent.match(/adapterType:\s*WalletType\[\s*['"]([^'"]+)['"]\s*\]/);
  const adapterType = adapterTypeMatch ? adapterTypeMatch[1] : 'core';
  
  // Run the dynamic validation test
  console.log(`Running dynamic validation for ${adapterName}Wallet as type: ${adapterType}...`);
  
  // Set environment variables for the test
  process.env.ADAPTER_PATH = `../packages/wallet/src/adapters/${adapterName}Wallet`;
  process.env.ADAPTER_TYPE = adapterType;
  
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