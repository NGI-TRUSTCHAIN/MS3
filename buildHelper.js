const path = require("path");
const child_process = require("child_process");
const execSync = child_process.execSync;

function buildAllPackages() {
  console.log("Building all packages via references...");
  execSync(`tsc -b tsconfig.packages.json`, { stdio: "inherit" });
}

function buildPackage(packageName) {
  console.log(`Building ${packageName}...`);
  const pkgPath = path.join(__dirname, `packages/${packageName}`);
  execSync(`tsc -b "${pkgPath}/tsconfig.json"`, { stdio: "inherit" });

  // Patch version, commit, etc. if desired
  execSync("npm version patch --no-git-tag-version", { stdio: "inherit", cwd: pkgPath });
  const NEW_VERSION = require(path.join(pkgPath, "package.json")).version;
  execSync(`git add . && git commit -m "Bump version to ${NEW_VERSION}"`, { stdio: "inherit", cwd: pkgPath });
}

module.exports = {
  buildAllPackages,
  buildPackage
};