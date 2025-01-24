const path = require("path");
const { execSync } = require("child_process");
const fs = require("fs");

function updateDependentPackages(packageName, version) {
  const packagesDir = path.resolve(__dirname, 'packages');
  const packages = fs.readdirSync(packagesDir);
  
  packages.forEach(pkg => {
    const pkgJsonPath = path.join(packagesDir, pkg, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (pkgJson.dependencies?.[`@m3s/${packageName}`]) {
        pkgJson.dependencies[`@m3s/${packageName}`] = `^${version}`;
        fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
        console.log(`Updated ${pkg}'s dependency on ${packageName} to ^${version}`);
      }
    }
  });
}

function publishPackage(packageName) {
  try {
    const pkgPath = path.resolve(__dirname, `packages/${packageName}`);
    console.log(`Publishing ${packageName} from ${pkgPath}...`);

    // Build first
    console.log("Building package...");
    execSync("npm run build", { stdio: "inherit", cwd: pkgPath });

    // Get current version
    const currentPkg = JSON.parse(fs.readFileSync(path.join(pkgPath, "package.json"), 'utf8'));
    const currentVersion = currentPkg.version;

    // Update dependencies in other packages BEFORE version bump
    console.log("Updating dependent packages...");
    updateDependentPackages(packageName, currentVersion);

    // Version bump
    console.log("Bumping version...");
    execSync("npm version patch --no-git-tag-version", { stdio: "inherit", cwd: pkgPath });
    
    // Git commit all changes
    execSync("git add .", { stdio: "inherit", cwd: __dirname });
    execSync(`git commit -m "chore: prepare ${packageName} ${currentVersion} for publish"`, {
      stdio: "inherit", 
      cwd: __dirname
    });

    // Publish current version
    console.log(`Publishing version ${currentVersion}...`);
    execSync("npm publish --access public", { stdio: "inherit", cwd: pkgPath });
    
    console.log(`Successfully published ${packageName}@${currentVersion}`);

  } catch (error) {
    console.error("Error publishing package:", error.message);
    process.exit(1);
  }
}

module.exports = { publishPackage };