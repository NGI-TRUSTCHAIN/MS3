/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");
const child_process = require("child_process");
const execSync = child_process.execSync;

// Specify the name of the library
const LIBRARY_NAME = "ms3-api";

try {
  // Step 1: Clean Git state
  console.log("Checking Git working directory...");
  const gitStatus = execSync("git status --porcelain").toString().trim();

  if (gitStatus) {
    console.log("Stashing uncommitted changes...");
    execSync("git stash --include-untracked", { stdio: "inherit" });
  }

  // Step 2: Clean ./dist folder and build the library
  console.log("Cleaning the ./dist folder...");
  const distPath = path.join(process.cwd(), "dist");
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
    console.log("./dist folder deleted.");
  } else {
    console.log("No ./dist folder found, skipping deletion.");
  }
  console.log("Building the library...");
  execSync("tsc", { stdio: "inherit" });

  // Step 3: Increment the version
  console.log("Incrementing the library version...");
  execSync("npm version patch --no-git-tag-version", { stdio: "inherit" });
  const NEW_VERSION = require(path.join(process.cwd(), "package.json")).version;

  // Step 4: Commit changes and tag the version
  console.log("Committing the new version...");
  execSync(`git add package.json package-lock.json`, { stdio: "inherit" });
  execSync(`git commit -m "Bump version to ${NEW_VERSION}"`, {
    stdio: "inherit",
  });

  console.log("Tagging the new version...");
  execSync(`git tag -a v${NEW_VERSION} -m "Version ${NEW_VERSION}"`, {
    stdio: "inherit",
  });

  // Step 5: Publish the library
  console.log("Publishing the library...");
  execSync("npm publish", { stdio: "inherit" });

  // Step 5: Package the library --- Not needed for this project it creates a .tgz file
  // console.log("Packing the library...");
  // execSync("npm pack", { stdio: "inherit" });
  // const PACKED_FILE = `${LIBRARY_NAME}-${NEW_VERSION}.tgz`;
  // console.log(`Packed file: ${PACKED_FILE}`);

  // Step 6: Restore stashed changes (if any)
  if (gitStatus) {
    console.log("Restoring stashed changes...");
    execSync("git stash pop", { stdio: "inherit" });
  }
} catch (error) {
  console.error(`An error occurred: ${error.message}`);
  process.exit(1);
}
