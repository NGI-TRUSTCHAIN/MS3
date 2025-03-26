import { resolve, join, dirname } from "path";
import { execSync } from "child_process";
import { readdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

// Fix path resolution for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

function updateDependentPackages(packageName, version) {
  // This function is fine - no changes needed
  const packagesDir = join(rootDir, 'packages');
  const packages = readdirSync(packagesDir);
  
  packages.forEach(pkg => {
    const pkgJsonPath = join(packagesDir, pkg, 'package.json');
    if (existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
      if (pkgJson.dependencies?.[`@m3s/${packageName}`]) {
        pkgJson.dependencies[`@m3s/${packageName}`] = `^${version}`;
        writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
        console.log(`Updated ${pkg}'s dependency on ${packageName} to ^${version}`);
      }
    }
  });
}

function updateVersionMatrix(packageName, version) {
  const utilsPath = join(rootDir, 'packages/utils');
  const matrixPath = join(utilsPath, 'src/versions/versionMatrix.json');
  const rootMatrixPath = join(rootDir, 'version-matrix.json');
  
  let matrix = { modules: {} };
  
  // Try to read existing matrix
  if (existsSync(matrixPath)) {
    try {
      matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
    } catch (e) {
      console.warn('Failed to parse existing matrix, creating new one');
    }
  }
  
  // Ensure structure exists
  if (!matrix.modules) {
    matrix.modules = {};
  }
  if (!matrix.modules[packageName]) {
    matrix.modules[packageName] = { versions: {} };
  }
  
  // Define adapters based on the package being updated
  const adapters = {};
  
 
  if (packageName === 'wallet') {
    // Get all adapter files
    const adapterDir = join(rootDir, 'packages/wallet/src/adapters');
    const adapterFiles = readdirSync(adapterDir)
      .filter(f => f.endsWith('Wallet.ts'))
      .map(f => f.replace('Wallet.ts', ''));
    
    // Use the update-version-matrix.js script for each adapter
    const { updateMatrixForAdapter } = require('./update-version-matrix.js');
    
    adapterFiles.forEach(adapter => {
      try {
        const adapterFeatures = updateMatrixForAdapter(adapter, false); // Don't write to file
        adapters[adapter] = adapterFeatures;
      } catch (err) {
        console.warn(`Failed to analyze adapter ${adapter}:`, err.message);
      }
    });
  } else {
    // Default adapter for other packages
    adapters["mockedAdapter"] = {
      minVersion: version,
      maxVersion: "*",
      supportedFeatures: {
        "basicFeature": { addedInVersion: version }
      }
    };
  }
  
  // Add version entry with adapter compatibility
  matrix.modules[packageName].versions[version] = {
    adapters: adapters
  };

  // Save to utils package
  writeFileSync(matrixPath, JSON.stringify(matrix, null, 2));
  
  // Also save to repository root for CDN access
  writeFileSync(rootMatrixPath, JSON.stringify(matrix, null, 2));
  
  console.log(`Updated version matrix for ${packageName}@${version}`);
  
  // Git add the root matrix file
  try {
    execSync("git add " + rootMatrixPath, { stdio: "inherit", cwd: rootDir });
  } catch (e) {
    console.warn('Failed to git add version matrix:', e.message);
  }
}

export function publishPackage(packageName) {
  try {
    const pkgPath = join(rootDir, `packages/${packageName}`);
    const pkgJsonPath = join(pkgPath, "package.json");
    
    if (!existsSync(pkgJsonPath)) {
      throw new Error(`Package ${packageName} not found at ${pkgPath}`);
    }
    
    // Read package.json BEFORE trying to access pkgJson.private
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    
    // Now we can safely check if it's private
    if (pkgJson.private) {
      console.log(`Skipping ${packageName} (marked as private)`);
      return;
    }
    
    console.log(`Publishing ${packageName} from ${pkgPath}...`);

    // Build first
    console.log("Building package...");
    execSync("npm run build", { stdio: "inherit", cwd: pkgPath });

    // Get current version - we already have pkgJson loaded
    const currentVersion = pkgJson.version;

    // Manually update version instead of using npm version
    console.log("Bumping version...");
    const versionParts = currentVersion.split('.');
    const major = parseInt(versionParts[0]);
    const minor = parseInt(versionParts[1]);
    const patch = parseInt(versionParts[2]);
    
    // Roll over patch to minor when it gets too large
    let newMajor = major;
    let newMinor = minor;
    let newPatch = patch;
    
    if (patch >= 99) {
      // Reset patch, increment minor
      newPatch = 0;
      newMinor = minor + 1;
    } else {
      // Just increment patch
      newPatch = patch + 1;
    }

    const newVersion = `${newMajor}.${newMinor}.${newPatch}`;
    
    // Update package.json with new version
    pkgJson.version = newVersion;
    writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
    console.log(`Version bumped from ${currentVersion} to ${newVersion}`);

    // Update dependencies in other packages
    console.log("Updating dependent packages...");
    updateDependentPackages(packageName, newVersion);

    // Update version matrix if publishing utils
    if (packageName === 'utils') {
      updateVersionMatrix('wallet', newVersion);
      updateVersionMatrix('smartContract', newVersion);
      updateVersionMatrix('crosschain', newVersion);
    }

    // Git commit all changes
    execSync("git add .", { stdio: "inherit", cwd: rootDir });
    execSync(`git commit -m "chore: prepare ${packageName} ${newVersion} for publish"`, {
      stdio: "inherit",
      cwd: rootDir
    });

    // Publish with --no-fund to avoid funding messages
    console.log(`Publishing version ${newVersion}...`);
    execSync("npm publish --access public --no-fund", { stdio: "inherit", cwd: pkgPath });

    console.log(`Successfully published ${packageName}@${newVersion}`);
    return newVersion;
  } catch (error) {
    console.error("Error publishing package:", error.message);
    process.exit(1);
  }
}