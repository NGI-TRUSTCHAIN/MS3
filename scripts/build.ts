import { resolve, join, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import fs from "fs";
import { bundleDependencies } from "./bundle.js";

// Fix path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

/**
 * Build registry and create tarball ONCE
 * @returns {string} Path to the registry tarball
 */
function buildRegistryTarball() {
  console.log('=== Building Registry ===');
  const registryPath = join(rootDir, 'packages/registry');
  
  // Build registry
  execSync("tsc --build", { stdio: "inherit", cwd: registryPath });
  
  // Increment version
  const pkgPath = join(registryPath, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const versionParts = pkgJson.version.split('.');
  versionParts[2] = String(parseInt(versionParts[2]) + 1);
  const newVersion = versionParts.join('.');
  pkgJson.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2));
  console.log(`Registry version updated to ${newVersion}`);
  
  // Create tarball
  execSync('npm pack', { stdio: 'inherit', cwd: registryPath });
  const tarballFile = `m3s-registry-${newVersion}.tgz`;
  const tarballPath = join(registryPath, tarballFile);
  
  console.log(`Created registry tarball: ${tarballFile}`);
  return { tarballPath, tarballFile, version: newVersion };
}


/**
 * Copy registry tarball to a package and update its package.json
 */
function copyRegistryToPackage(packageName:string, tarballPath:string, tarballFile:any) {
  const pkgPath = join(rootDir, `packages/${packageName}`);
  const destPath = join(pkgPath, tarballFile);
  
  // Remove any old tarballs
  const oldTarballs = fs.readdirSync(pkgPath)
    .filter(file => file.startsWith('m3s-registry-') && file.endsWith('.tgz'));
  
  for (const oldFile of oldTarballs) {
    fs.unlinkSync(join(pkgPath, oldFile));
  }
  
  // Copy new tarball
  fs.copyFileSync(tarballPath, destPath);
  
  // Update package.json
  const pkgJsonPath = join(pkgPath, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  
  // Set dependency
  pkgJson.dependencies = pkgJson.dependencies || {};
  pkgJson.dependencies['m3s-registry'] = `file:${tarballFile}`;
  
  // Update files array
  pkgJson.files = pkgJson.files || ['dist'];
  pkgJson.files = pkgJson.files.filter(
    (file:any) => !file.startsWith('m3s-registry-') || file === tarballFile
  );
  if (!pkgJson.files.includes(tarballFile)) {
    pkgJson.files.push(tarballFile);
  }
  
  // Ensure exports field for 'm3s-registry'
  pkgJson.exports = pkgJson.exports || {};
  pkgJson.exports['m3s-registry'] = {
    import: './dist/internal/registry.js',
    require: './dist/internal/registry.js'
  };
  
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
  console.log(`Updated ${packageName} to use registry tarball ${tarballFile}`);
}


/**
 * Build all packages
 */
export async function buildPackage(packageName: string) {
  const pkgPath = join(rootDir, `packages/${packageName}`);
  console.log(`\n=== Building ${packageName} ===`);
  
  try {
    // For all packages, first install dependencies
    execSync("npm install --legacy-peer-deps", { 
      stdio: "inherit", 
      cwd: pkgPath 
    });
    
    // Build with TypeScript
    execSync("tsc --build", { 
      stdio: "inherit", 
      cwd: pkgPath 
    });
    
    console.log(`Successfully built ${packageName}`);
  } catch (error: any) {
    console.error(`Error building ${packageName}:`, error.message);
    process.exit(1);
  }
}

/**
 * Build all packages
 */
export async function buildAll() {
  try {
    // 1. COMMON STEP: Build registry and create tarball once
    const { tarballPath, tarballFile } = buildRegistryTarball();
    
    // 2. COMMON STEP: Bundle registry into all packages
    const packages = ['wallet', 'crosschain', 'smartContract'];
    for (const pkg of packages) {
      await bundleDependencies(pkg);
      copyRegistryToPackage(pkg, tarballPath, tarballFile);
    }
    
    // 3. Build each package
    for (const pkg of packages) {
      await buildPackage(pkg);
    }
    
    console.log("\n✓ All packages built successfully");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

// CLI entry point
if (import.meta.url === import.meta.url) {
  const packageName = process.argv[2];
  
  if (packageName) {
    if (packageName === 'registry') {
      // Just build registry
      buildRegistryTarball();
    } else {
      // For other packages, make sure registry is built first
      const { tarballPath, tarballFile } = buildRegistryTarball();
      bundleDependencies(packageName);
      copyRegistryToPackage(packageName, tarballPath, tarballFile);
      buildPackage(packageName);
    }
  } else {
    buildAll();
  }
}