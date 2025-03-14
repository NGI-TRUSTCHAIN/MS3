const path = require("path");
const fs = require("fs");
const { publishPackage } = require("./publishPackage");

const rootDir = path.resolve(__dirname, '..');
const packagesDir = path.join(rootDir, 'packages');

// Get all publishable packages (not marked as private)
function getPublishablePackages() {
  return fs.readdirSync(packagesDir)
    .filter(pkg => {
      const pkgJsonPath = path.join(packagesDir, pkg, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
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