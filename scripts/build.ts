import { resolve, join, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { packRegistry } from "./pack-registry.js";
import fs from "fs";

// Fix path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');


/**
 * Build a specific package
 * @param {string} packageName Name of the package to build
 */
export function buildPackage(packageName:string) {
  const pkgPath = join(rootDir, `packages/${packageName}`);
  console.log(`Building ${packageName} from ${pkgPath}...`);
  
  try {
    // Special handling for wallet package to ensure registry is available
    if (packageName === 'wallet') {
      // First make sure registry is built
      execSync("npm run build:registry", { stdio: "inherit", cwd: rootDir });
      
      // Clean up node_modules to ensure a fresh install
      const nodeModulesPath = join(pkgPath, 'node_modules');
      const packageLockPath = join(pkgPath, 'package-lock.json');
      
      if (fs.existsSync(nodeModulesPath)) {
        console.log(`Cleaning up node_modules in ${packageName}...`);
        if (process.platform === 'win32') {
          // Windows-specific command
          try {
            execSync(`rmdir /s /q "${nodeModulesPath}"`, { stdio: 'inherit' });
          } catch (e) {
            console.log('Could not delete node_modules folder, continuing...');
          }
        } else {
          execSync(`rm -rf ${nodeModulesPath}`, { stdio: 'inherit' });
        }
      }
      
      if (fs.existsSync(packageLockPath)) {
        console.log(`Removing package-lock.json in ${packageName}...`);
        fs.unlinkSync(packageLockPath);
      }
      
      // Then pack registry and update wallet's dependency
      const tarballFile = packRegistry();
      
      // Install dependencies including the tarball (just like in your ksides project)
      console.log(`Installing dependencies for ${packageName}...`);
      execSync(`npm install --legacy-peer-deps`, { 
        stdio: 'inherit', 
        cwd: pkgPath 
      });
    } else {
      // For other packages, just install dependencies
      execSync("npm install --legacy-peer-deps", { 
        stdio: "inherit", 
        cwd: pkgPath 
      });
    }
    
    // Build with TypeScript
    execSync("tsc --build", { 
      stdio: "inherit", 
      cwd: pkgPath 
    });
    
    console.log(`Successfully built ${packageName}`);
  } catch (error:any) {
    console.error(`Error building ${packageName}:`, error.message);
    process.exit(1);
  }
}

/**
 * Build all packages in the correct order
 */
export function buildAllPackages() {
  try {
    // Always build registry first
    console.log("Building registry package first...");
    buildPackage('registry');
  } catch (error:any) {
    console.error("Error building registry package:", error.message);
    console.log("Continuing with other packages...");
  }
  
  // Build remaining packages
  const packages = ['wallet', 'crosschain', 'smartContract'];
  for (const pkg of packages) {
    try {
      buildPackage(pkg);
    } catch (error:any) {
      console.error(`Error building ${pkg}:`, error.message);
    }
  }
  
  console.log('All packages built successfully');
}

// CLI entry point
if (import.meta.url === new URL(import.meta.url).href) {
  const packageName = process.argv[2];
  
  if (packageName) {
    buildPackage(packageName);
  } else {
    buildAllPackages();
  }
}