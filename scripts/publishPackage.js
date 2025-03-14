const path = require("path");
const { execSync } = require("child_process");
const fs = require("fs");

const rootDir = path.resolve(__dirname, '..');

function updateDependentPackages(packageName, version) {
  // This function is fine - no changes needed
  const packagesDir = path.join(rootDir, 'packages');
  const packages = fs.readdirSync(packagesDir);
  
  packages.forEach(pkg => {
    const pkgJsonPath = path.join(packagesDir, pkg, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (pkgJson.dependencies?.[`@m3s/${packageName}`]) {
        pkgJson.dependencies[`@m3s/${packageName}`] = `^${version}`;
        fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
        console.log(`Updated ${pkg}'s dependency on ${packageName} to ^${version}`);
      }
    }
  });
}

function updateVersionMatrix(packageName, version) {
  // This function is also fine
  const utilsPath = path.join(rootDir, 'packages/utils');
  const matrixPath = path.join(utilsPath, 'src/versions/versionMatrix.json');
  
  if (fs.existsSync(matrixPath)) {
    const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
    
    matrix[packageName] = {
      mockedAdapter: {
        supported: true,
        minVersion: version,
        maxVersion: "*"
      }
    };

    fs.writeFileSync(matrixPath, JSON.stringify(matrix, null, 2));
    console.log(`Updated version matrix for ${packageName}@${version}`);
  }
}

function publishPackage(packageName) {
  try {
    const pkgPath = path.join(rootDir, `packages/${packageName}`);
    const pkgJsonPath = path.join(pkgPath, "package.json");
    
    if (!fs.existsSync(pkgJsonPath)) {
      throw new Error(`Package ${packageName} not found at ${pkgPath}`);
    }
    
    // Read package.json BEFORE trying to access pkgJson.private
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    
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
    const patchVersion = parseInt(versionParts[2]) + 1;
    const newVersion = `${versionParts[0]}.${versionParts[1]}.${patchVersion}`;
    
    // Update package.json with new version
    pkgJson.version = newVersion;
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
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

module.exports = { publishPackage };