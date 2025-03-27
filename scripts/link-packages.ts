import { resolve, join, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

// Fix path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

/**
 * Link packages for local development
 */
export function linkPackages() {
  try {
    console.log('Setting up npm links for local development...');
    
    // First, build registry
    const registryPath = join(rootDir, 'packages/registry');
    console.log('Building registry...');
    execSync('npm run build', { stdio: 'inherit', cwd: registryPath });
    
    // Create global link for registry
    console.log('Creating global link for registry...');
    execSync('npm link', { stdio: 'inherit', cwd: registryPath });
    
    // Link registry to wallet
    const walletPath = join(rootDir, 'packages/wallet');
    console.log('Linking registry to wallet...');
    execSync('npm link @m3s/registry', { stdio: 'inherit', cwd: walletPath });
    
    // Now build and link wallet
    console.log('Building wallet...');
    execSync('npm run build', { stdio: 'inherit', cwd: walletPath });
    
    // Also link other packages that need registry
    const otherPackages = ['crosschain', 'smartContract'];
    for (const pkg of otherPackages) {
      const pkgPath = join(rootDir, `packages/${pkg}`);
      console.log(`Linking registry to ${pkg}...`);
      execSync('npm link @m3s/registry', { stdio: 'inherit', cwd: pkgPath });
    }
    
    console.log('All packages linked successfully for development!');
  } catch (error) {
    console.error('Error linking packages:', error);
    process.exit(1);
  }
}

// Run as standalone script if called directly
if (import.meta.url === new URL(import.meta.url).href) {
  linkPackages();
}