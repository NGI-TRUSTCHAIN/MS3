import fs from 'fs';
import path from 'path';
import { globSync } from 'glob'; // Default import
import {logger} from '../logger.js';

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
  path.join(rootDir, 'packages', '*', 'tsconfig.tsbuildinfo'),
  path.join(rootDir, 'packages', '*', 'cache'),
  path.join(rootDir, 'packages', '*', 'artifacts')
];

logger.notice("Starting cleanup...");
logger.info(`Root directory determined as: ${rootDir}`);

patterns.forEach(pattern => {
  const normalizedPattern = process.platform === "win32" ? pattern.replace(/\\/g, '/') : pattern;
  logger.info(`Searching for items matching: ${normalizedPattern}`);

  try {
    // Use the GlobSync class constructor and access the 'found' property
    const itemsToDelete = globSync(normalizedPattern, { dot: true, absolute: true, nodir: false });

    if (itemsToDelete.length > 0) {
      itemsToDelete.forEach((item:any) => {
        try {
          if (fs.existsSync(item)) {
            logger.notice(`Deleting: ${item}`);
            fs.rmSync(item, { recursive: true, force: true });
          }
        } catch (err: any) {
          logger.error(`Error deleting ${item}: ${err.message}`);
        }
      });
    } else {
      logger.warning(`No items found for pattern: ${normalizedPattern}`);
    }
  } catch (globError: any) {
    logger.error(`Error during glob search for pattern ${normalizedPattern}: ${globError.message}`);
  }
});

logger.notice("Cleanup finished.");