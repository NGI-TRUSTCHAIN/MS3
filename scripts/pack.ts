import { resolve, join, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import fs from "fs";

// Fix path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

/**
 * Pack the registry as a tarball for local dependencies
 */
export function packRegistry() {
  try {
    const registryPath = join(rootDir, 'packages/registry');
    
    console.log('Building registry...');
    execSync('npm run build', { stdio: 'inherit', cwd: registryPath });
    
    console.log('Creating registry tarball...');
    execSync('npm pack', { stdio: 'inherit', cwd: registryPath });
    
    // Get the generated tarball filename - npm removes the @ symbol in the filename
    const files = fs.readdirSync(registryPath);
    const tarballFile = files.find(file => file.startsWith('m3s-registry-') && file.endsWith('.tgz'));
    
    if (!tarballFile) {
      throw new Error('Registry tarball not found after packing');
    }
    
    console.log(`Created tarball: ${tarballFile}`);
    
    // Update the wallet's package.json to point to the correct tarball
    updateWalletDependency(tarballFile);
    
    return tarballFile;
  } catch (error) {
    console.error('Error packing registry:', error);
    process.exit(1);
  }
}

/**
 * Update the wallet package.json to use the correct registry tarball
 */
function updateWalletDependency(tarballFile: string) {
  const walletPackagePath = join(rootDir, 'packages/wallet/package.json');
  const packageJson = JSON.parse(fs.readFileSync(walletPackagePath, 'utf8'));
  
  // Update the dependency
  packageJson.dependencies['@m3s/registry'] = `file:../registry/${tarballFile}`;
  
  // Write the updated package.json
  fs.writeFileSync(walletPackagePath, JSON.stringify(packageJson, null, 2) + '\n');
  
  console.log(`Updated wallet's package.json to use ${tarballFile}`);
}

// Run as standalone script if called directly
if (import.meta.url === new URL(import.meta.url).href) {
  packRegistry();
}