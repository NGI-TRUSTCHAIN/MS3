const path = require("path");
const { execSync } = require("child_process");
const fs = require("fs");

// Fix path resolution
const rootDir = path.resolve(__dirname, '..');

function buildPackage(packageName) {
  const pkgPath = path.join(rootDir, `packages/${packageName}`);
  console.log(`Building ${packageName} from ${pkgPath}...`);
  
  try {
    // Install dependencies.
    execSync("npm install --legacy-peer-deps", { stdio: "inherit", cwd: pkgPath });
    
    execSync("tsc", { stdio: "inherit", cwd: pkgPath });
    
    // If building wallet, bundle utils into it
    if (packageName === 'wallet') {
      execSync('node scripts/update-imports.js', { stdio: "inherit", cwd: rootDir });

      console.log('Bundling necessary utils code into wallet package...');
      const utilsSourcePath = path.join(rootDir, 'packages/utils/dist');
      const walletDistPath = path.join(pkgPath, 'dist/utils');
      
      // Create utils directory in wallet dist if it doesn't exist
      execSync(`if not exist ${walletDistPath} mkdir ${walletDistPath}`, { shell: true });
      
      // Copy necessary utils files
      execSync(`copy /Y ${utilsSourcePath}\\*.* ${walletDistPath}\\`, { shell: true });
      
      // Update package.json to remove utils dependency
      const packageJsonPath = path.join(pkgPath, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Remove utils dependency
      if (packageJson.dependencies && packageJson.dependencies['@m3s/utils']) {
        delete packageJson.dependencies['@m3s/utils'];
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log('Removed @m3s/utils dependency from wallet package.json');
      }
    }
    
    console.log(`Successfully built ${packageName}`);
  } catch (error) {
    console.error(`Error building ${packageName}:`, error.message);
    process.exit(1);
  }
}

function buildAllPackages() {
  // Always build utils first
  buildPackage('utils');
  
  ['wallet', 'crosschain', 'smartContract'].forEach(buildPackage);
}

module.exports = { buildPackage, buildAllPackages };