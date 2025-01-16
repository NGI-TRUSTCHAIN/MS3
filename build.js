/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");
const child_process = require("child_process");
const execSync = child_process.execSync;

// Specify the name of the library
const LIBRARY_NAME = "ms3-api";

try {
  // Build the library
  console.log("Building the library...");
  execSync("tsc", { stdio: "inherit" });

  // Increment the version
  console.log("Incrementing the library version...");
  execSync("npm version patch", { stdio: "inherit" });
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const NEW_VERSION = require(path.join(process.cwd(), "package.json")).version; // Ensure to require the updated package.json

  // Package the library
  console.log("Packing the library...");
  execSync("npm pack", { stdio: "inherit" });
  const PACKED_FILE = `${LIBRARY_NAME}-${NEW_VERSION}.tgz`;
  console.log(`Packed file: ${PACKED_FILE}`);
} catch (error) {
  console.error(`An error occurred: ${error.message}`);
  process.exit(1);
}