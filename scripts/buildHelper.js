const path = require("path");
const { execSync } = require("child_process");

// Fix path resolution
const rootDir = path.resolve(__dirname, '..');

function buildPackage(packageName) {
  const pkgPath = path.join(rootDir, `packages/${packageName}`);
  console.log(`Building ${packageName} from ${pkgPath}...`);
  
  try {
    // Install dependencies.
    execSync("npm install --legacy-peer-deps", { stdio: "inherit", cwd: pkgPath });
    
    execSync("tsc", { stdio: "inherit", cwd: pkgPath });
    
    // For utils package, also copy version matrix
    if (packageName === 'utils') {
      const versionMatrixSrc = path.join(pkgPath, 'src/versions/versionMatrix.json');
      const versionMatrixDest = path.join(pkgPath, 'dist/versions');
      
      execSync(`if not exist ${versionMatrixDest} mkdir ${versionMatrixDest}`, { shell: true });
      execSync(`copy /Y ${versionMatrixSrc} ${versionMatrixDest}\\`, { shell: true });
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