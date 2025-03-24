import { resolve, join,dirname } from "path";
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

// Fix path resolution
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

export function buildPackage(packageName) {
  const pkgPath = join(rootDir, `packages/${packageName}`);
  console.log(`Building ${packageName} from ${pkgPath}...`);
  
  try {
    // Install dependencies.
    execSync("npm install --legacy-peer-deps", { stdio: "inherit", cwd: pkgPath });
    
    execSync("tsc", { stdio: "inherit", cwd: pkgPath });
    
    // If building wallet, bundle utils into it
    if (packageName === 'wallet') {
      execSync('node scripts/update-imports.js', { stdio: "inherit", cwd: rootDir });

      console.log('Bundling necessary utils code into wallet package...');
      const utilsSourcePath = join(rootDir, 'packages/utils/dist');
      const walletDistPath = join(pkgPath, 'dist/utils');
      
      // Create utils directory in wallet dist if it doesn't exist
      execSync(`if not exist ${walletDistPath} mkdir ${walletDistPath}`, { shell: true });
      
      // Copy necessary utils files
      execSync(`copy /Y ${utilsSourcePath}\\*.* ${walletDistPath}\\`, { shell: true });
      
      // Update package.json to remove utils dependency
      const packageJsonPath = join(pkgPath, 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      
      // Remove utils dependency
      if (packageJson.dependencies && packageJson.dependencies['@m3s/utils']) {
        delete packageJson.dependencies['@m3s/utils'];
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log('Removed @m3s/utils dependency from wallet package.json');
      }
    }
    
    console.log(`Successfully built ${packageName}`);
  } catch (error) {
    console.error(`Error building ${packageName}:`, error.message);
    process.exit(1);
  }
}

export function buildAllPackages() {
  // Always build utils first
  buildPackage('utils');
  
  ['wallet', 'crosschain', 'smartContract'].forEach(buildPackage);
}