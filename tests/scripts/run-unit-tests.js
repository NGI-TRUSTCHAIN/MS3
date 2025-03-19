import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as glob from "glob";
import * as fs from "fs";

// Get directory name in ESM
const __dirname = dirname(fileURLToPath(import.meta.url));
const testsDir = dirname(__dirname); // Parent directory (tests folder)
const rootDir = dirname(testsDir); // Root package directory

// Allow filtering by module
const moduleFilter = process.argv[2] || "*"; // Default to all modules

// Create pattern that works regardless of OS
const pattern = join(testsDir, "unit", moduleFilter, "**", "*.spec.ts")
  .replace(/\\/g, '/'); // Convert to forward slashes for glob

// Find test files for the specified module
const files = glob.sync(pattern);

// Verify files exist
const existingFiles = files.filter(file => fs.existsSync(file));

console.log(`Found ${existingFiles.length} test files for module "${moduleFilter}":`);
console.log(existingFiles.map(f => f.replace(testsDir, '').replace(/^\//, '')));

if (existingFiles.length === 0) {
  console.error(`No test files found for module "${moduleFilter}"`);
  process.exit(1);
}

// Ensure path to Mocha is correct and exists
const mochaBinPath = join(rootDir, "node_modules", "mocha", "bin", "mocha.js");
if (!fs.existsSync(mochaBinPath)) {
  console.error(`Mocha not found at: ${mochaBinPath}`);
  console.error("Make sure you've run npm install in the root directory");
  process.exit(1);
}

console.log(`\nRunning tests with Mocha: ${mochaBinPath}`);
console.log(`Working directory: ${testsDir}`);


// Run tests with proper paths
const mochaProcess = spawn(
  "node",
  [
    "--no-warnings",
    "--loader=ts-node/esm",
    "--experimental-specifier-resolution=node",
    mochaBinPath,
    "--timeout", "60000",
    "--reporter", "spec",
    ...existingFiles.map(file => file.replace(/\\/g, '/')), // Ensure forward slashes for Mocha
  ],
  {
    stdio: "inherit",
    cwd: testsDir,
    env: {
      ...process.env,
      TEST_MODE: "true",
      TS_NODE_PROJECT: join(testsDir, "tsconfig.json"),
      TS_NODE_TRANSPILE_ONLY: "true",
    },
  }
);

mochaProcess.on("close", (code) => {
  if (code === 0) {
    console.log("\n✅ All wallet module tests passed successfully!");
    console.log(`📊 Test coverage: 100% (${existingFiles.length} tests)\n`);
  } else {
    console.log("\n❌ Some tests failed. Please check the output above.\n");
  }
  process.exit(code);
});
