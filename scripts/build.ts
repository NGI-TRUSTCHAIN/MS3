import { resolve, join, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

/**
 * Build a specific package
 */
export async function buildPackage(packageName: string) {
  const pkgPath = join(rootDir, `packages/${packageName}`);
  console.log(`\n=== Building ${packageName} ===`);
  
  try {
    // Install dependencies
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
    // Define all packages to build
    const packages = ['wallet', 'crosschain', 'smartContract'];
    
    // Build each package
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
    buildPackage(packageName);
  } else {
    buildAll();
  }
}