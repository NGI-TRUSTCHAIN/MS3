#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Get adapter name from argument
const adapterName = process.argv[2];
if (!adapterName) {
  console.error('Please specify adapter name');
  process.exit(1);
}

console.log(`Preparing to merge adapter: ${adapterName}`);
console.log('This will:');
console.log(`1. Checkout the adapter branch (github/${adapterName})`);
console.log('2. Run integration tests');
console.log('3. If tests pass, merge to develop');

rl.question('Continue? (y/n) ', (answer) => {
  if (answer.toLowerCase() !== 'y') {
    console.log('Operation cancelled');
    rl.close();
    return;
  }

  try {
    // Checkout the adapter branch
    execSync(`git checkout github/${adapterName}`, { stdio: 'inherit' });
    
    // Run integration tests
    console.log('Running integration tests...');
    execSync('npm run test:integration', { stdio: 'inherit' });
    
    // If we get here, tests passed
    console.log('Integration tests passed!');
    
    // Checkout develop and merge
    execSync('git checkout develop', { stdio: 'inherit' });
    execSync(`git merge github/${adapterName}`, { stdio: 'inherit' });
    
    console.log(`Successfully merged adapter ${adapterName} to develop!`);
  } catch (error) {
    console.error('Error during merge process:', error.message);
  }
  
  rl.close();
});