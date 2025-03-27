import { resolve, join, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

export function packRegistry() {
    try {
        const registryPath = join(rootDir, 'packages/registry');
        const walletPath = join(rootDir, 'packages/wallet');
        
        // Build registry
        console.log('Building registry...');
        execSync('npm run build', { stdio: 'inherit', cwd: registryPath });
        
        // Increment version
        console.log('Incrementing registry version...');
        const pkgPath = join(registryPath, 'package.json');
        const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const versionParts = pkgJson.version.split('.');
        versionParts[2] = String(parseInt(versionParts[2]) + 1);
        const newVersion = versionParts.join('.');
        pkgJson.version = newVersion;
        fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2));
        console.log(`Registry version updated to ${newVersion}`);
        
        // Create tarball
        console.log('Creating registry tarball...');
        execSync('npm pack', { stdio: 'inherit', cwd: registryPath });
        
        // Tarball filename (now without @ prefix)
        const tarballFile = `m3s-registry-${newVersion}.tgz`;
        const srcPath = join(registryPath, tarballFile);
        
        // Check if tarball was created
        if (!fs.existsSync(srcPath)) {
            throw new Error(`Tarball not found at ${srcPath}`);
        }
        
        // Delete old tarballs in wallet directory
        const oldTarballs = fs.readdirSync(walletPath)
            .filter(file => file.startsWith('m3s-registry-') && file.endsWith('.tgz'));
        
        for (const oldFile of oldTarballs) {
            fs.unlinkSync(join(walletPath, oldFile));
            console.log(`Deleted old tarball: ${oldFile}`);
        }
        
        // Copy tarball to wallet directory
        const destPath = join(walletPath, tarballFile);
        fs.copyFileSync(srcPath, destPath);
        fs.unlinkSync(srcPath); // Clean up original
        console.log(`Copied ${tarballFile} to wallet package`);
        
        // Update wallet's package.json with non-scoped name
        const walletPkgPath = join(walletPath, 'package.json');
        const walletPkg = JSON.parse(fs.readFileSync(walletPkgPath, 'utf8'));
        walletPkg.dependencies['m3s-registry'] = `file:${tarballFile}`;  // Non-scoped name
        
        // Ensure tarball is included in files array
        if (!walletPkg.files) {
            walletPkg.files = ['dist'];
        }
        
        // Remove any old registry tarballs from files array
        walletPkg.files = walletPkg.files.filter(
            (file: any) => !file.startsWith('m3s-registry-') || file === tarballFile
        );
        
        // Add new tarball to files array
        if (!walletPkg.files.includes(tarballFile)) {
            walletPkg.files.push(tarballFile);
        }
        
        fs.writeFileSync(walletPkgPath, JSON.stringify(walletPkg, null, 2));
        console.log(`Updated wallet package.json to use ${tarballFile}`);
        
        // Install the tarball in wallet package
        console.log('Installing tarball in wallet package...');
        execSync(`npm install --legacy-peer-deps ${tarballFile}`, {
            stdio: 'inherit',
            cwd: walletPath
        });
        
        return tarballFile;
    } catch (error) {
        console.error('Error packing registry:', error);
        process.exit(1);
    }
}

if (import.meta.url === new URL(import.meta.url).href) {
    packRegistry();
}