import { resolve, join, dirname } from "path";
import { execSync } from "child_process";
import { readdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

// Fix path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

/**
 * Update the dependencies of other packages to use the new version
 * @param {string} packageName The package name that was updated
 * @param {string} version The new version number
 */
function updateDependentPackages(packageName:string, version:string) {
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

/**
 * Publish a package to NPM
 * @param {string} packageName The package to publish
 * @returns {string|undefined} The new version if successful
 */
export function publishPackage(packageName:string) {
  try {
    const pkgPath = join(rootDir, `packages/${packageName}`);
    const pkgJsonPath = join(pkgPath, "package.json");
    
    if (!existsSync(pkgJsonPath)) {
      throw new Error(`Package ${packageName} not found at ${pkgPath}`);
    }
    
    // Read package.json before accessing private property
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    
    // Check if it's private
    if (pkgJson.private) {
      console.log(`Skipping ${packageName} (marked as private)`);
      return;
    }
    
    console.log(`Publishing ${packageName} from ${pkgPath}...`);

    // Build first
    console.log("Building package...");
    execSync("npm run build", { stdio: "inherit", cwd: pkgPath });

    // Get current version
    const currentVersion = pkgJson.version;

    // Manually update version
    console.log("Bumping version...");
    const versionParts = currentVersion.split('.');
    const major = parseInt(versionParts[0]);
    const minor = parseInt(versionParts[1]);
    const patch = parseInt(versionParts[2]);
    
    // Increment patch, roll over to minor if needed
    let newMajor = major;
    let newMinor = minor;
    let newPatch = patch;
    
    if (patch >= 99) {
      newPatch = 0;
      newMinor = minor + 1;
    } else {
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
  } catch (error:any) {
    console.error("Error publishing package:", error.message);
    process.exit(1);
  }
}

/**
 * Get all packages that can be published (not marked as private)
 * @returns {string[]} Array of package names
 */
export function getPublishablePackages() {
  const packagesDir = join(rootDir, 'packages');
  return readdirSync(packagesDir)
    .filter(dir => {
      const pkgJsonPath = join(packagesDir, dir, 'package.json');
      if (!existsSync(pkgJsonPath)) return false;
      
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
      return !pkgJson.private;
    });
}

/**
 * Publish all packages
 */
export function publishAllPackages() {
  const packagesToPublish = getPublishablePackages();
  console.log(`Publishing packages: ${packagesToPublish.join(', ')}`);
  
  // Publish in order
  for (const pkg of packagesToPublish) {
    console.log(`\n=== Publishing ${pkg} ===`);
    publishPackage(pkg);
  }

  console.log("\nAll packages published successfully!");
}

// CLI entry point
if (import.meta.url === new URL(import.meta.url).href) {
  const packageName = process.argv[2];
  
  if (packageName) {
    publishPackage(packageName);
  } else {
    publishAllPackages();
  }
}