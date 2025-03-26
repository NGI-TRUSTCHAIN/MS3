import { fs } from 'fs';
import { path } from 'path';

function updateMatrixForAdapter(adapterName, writeToFile = true) {
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
  
  // Create the adapter entry
  const adapterEntry = {
    minVersion: "1.0.0",
    maxVersion: "*",
    supportedFeatures: methods.reduce((acc, method) => {
      acc[method] = { addedInVersion: "1.0.0" };
      return acc;
    }, {})
  };
  
  // Add to matrix
  matrix.modules.wallet.versions[walletVersion].adapters[adapterName] = adapterEntry;
  
  // Only write to files if writeToFile is true
  if (writeToFile) {
    // Write updated matrix back
    fs.writeFileSync(matrixPath, JSON.stringify(matrix, null, 2));
    
    // Also update root version matrix
    const rootMatrixPath = path.join(__dirname, '..', 'version-matrix.json');
    fs.writeFileSync(rootMatrixPath, JSON.stringify(matrix, null, 2));
    
    console.log(`Version matrix updated with capabilities for ${adapterName} adapter`);
  }
  
  // Return the adapter entry for programmatic use
  return adapterEntry;
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