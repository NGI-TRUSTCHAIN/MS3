// scripts/update-version-matrix.js (extended)
// const fs = require('fs');
// const path = require('path');
import { fs } from 'fs';
import { path } from 'path';

function updateMatrixForAdapter(adapterName) {
  // Read current matrix
  const matrixPath = path.join(__dirname, '..', 'packages/utils/src/versions/versionMatrix.json');
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  
  // Read adapter file to inspect implemented methods
  const adapterPath = path.join(__dirname, '..', 'packages/wallet/src/adapters', `${adapterName}Wallet.ts`);
  const adapterContent = fs.readFileSync(adapterPath, 'utf8');
  
  // Extract method signatures
  const methodRegex = /async\s+(\w+)\s*\([^)]*\)/g;
  const methods = [];
  let match;
  
  while ((match = methodRegex.exec(adapterContent)) !== null) {
    methods.push(match[1]);
  }
  
  // Get current wallet version
  const pkgPath = path.join(__dirname, '..', 'packages/wallet/package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const walletVersion = pkgJson.version;
  
  // Ensure wallet module exists
  if (!matrix.modules.wallet) {
    matrix.modules.wallet = { versions: {} };
  }
  
  // Ensure wallet version exists
  if (!matrix.modules.wallet.versions[walletVersion]) {
    matrix.modules.wallet.versions[walletVersion] = { adapters: {} };
  }
  
  // Add adapter with detected features
  matrix.modules.wallet.versions[walletVersion].adapters[adapterName] = {
    minVersion: "1.0.0",
    maxVersion: "*",
    supportedFeatures: methods.reduce((acc, method) => {
      acc[method] = { addedInVersion: "1.0.0" };
      return acc;
    }, {})
  };
  
  // Write updated matrix back
  fs.writeFileSync(matrixPath, JSON.stringify(matrix, null, 2));
  
  // Also update root version matrix
  const rootMatrixPath = path.join(__dirname, '..', 'version-matrix.json');
  fs.writeFileSync(rootMatrixPath, JSON.stringify(matrix, null, 2));
  
  console.log(`Version matrix updated with capabilities for ${adapterName} adapter`);
}

// Run if called directly
if (require.main === module) {
  const adapterName = process.argv[2];
  if (!adapterName) {
    console.error('Please provide adapter name');
    process.exit(1);
  }
  updateMatrixForAdapter(adapterName);
}

module.exports = { updateMatrixForAdapter };