import { resolve, join } from "path";
import { readdirSync, existsSync, readFileSync } from "fs";
import { publishPackage } from "./publishPackage.js";

const rootDir = resolve(__dirname, '..');
const packagesDir = join(rootDir, 'packages');

// Get all publishable packages (not marked as private)
function getPublishablePackages() {
  return readdirSync(packagesDir)
    .filter(pkg => {
      const pkgJsonPath = join(packagesDir, pkg, 'package.json');
      if (existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
        return !pkgJson.private; // Only include non-private packages
      }
      return false;
    });
}

// Publish all non-private packages
const packagesToPublish = getPublishablePackages();
console.log(`Publishing packages: ${packagesToPublish.join(', ')}`);

packagesToPublish.forEach(pkg => {
  console.log(`\n=== Publishing ${pkg} ===`);
  publishPackage(pkg);
});

console.log("\nAll packages published successfully!");