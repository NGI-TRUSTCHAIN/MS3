import fs from 'fs';
import path from 'path';
// import { GlobSync } from 'glob'; // Old way
import glob from 'glob'; // Default import
const { GlobSync } = glob; // Destructure GlobSync from the default import

// Determine the root directory of the monorepo.
let currentDir = path.dirname(new URL(import.meta.url).pathname);
// On Windows, pathname starts with an extra slash, e.g., /C:/Users/...
// We need to remove it if present for path.resolve to work correctly.
if (process.platform === "win32" && currentDir.startsWith('/') && currentDir[2] === ':') {
    currentDir = currentDir.substring(1);
}
const rootDir = path.resolve(currentDir, '..'); // Moves up one level from 'scripts' to the monorepo root

const patterns = [
  path.join(rootDir, 'packages', '*', 'dist'),
  path.join(rootDir, 'packages', '*', 'tsconfig.tsbuildinfo')
];

console.log("Starting cleanup...");
console.log(`Root directory determined as: ${rootDir}`);

patterns.forEach(pattern => {
  const normalizedPattern = process.platform === "win32" ? pattern.replace(/\\/g, '/') : pattern;
  console.log(`Searching for items matching: ${normalizedPattern}`);

  try {
    // Use the GlobSync class constructor and access the 'found' property
    const globber = new GlobSync(normalizedPattern, { dot: true, absolute: true, nodir: false });
    const itemsToDelete = globber.found;

    if (itemsToDelete.length > 0) {
      itemsToDelete.forEach(item => {
        try {
          if (fs.existsSync(item)) {
            console.log(`Deleting: ${item}`);
            fs.rmSync(item, { recursive: true, force: true });
          }
        } catch (err: any) {
          console.error(`Error deleting ${item}: ${err.message}`);
        }
      });
    } else {
      console.log(`No items found for pattern: ${normalizedPattern}`);
    }
  } catch (globError: any) {
    console.error(`Error during glob search for pattern ${normalizedPattern}: ${globError.message}`);
  }
});

console.log("Cleanup finished.");