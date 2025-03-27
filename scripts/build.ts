import { resolve, join, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { packRegistry } from "./pack-registry.js";

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
      // Pack registry and update wallet's dependency before building
      packRegistry();
    }
    
    // Install dependencies
    execSync("npm install --legacy-peer-deps", { stdio: "inherit", cwd: pkgPath });
    
    // Build with TypeScript
    execSync("tsc", { stdio: "inherit", cwd: pkgPath });
    
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