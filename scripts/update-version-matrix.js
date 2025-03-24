import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Path resolution for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Read the source version matrix
const sourcePath = join(rootDir, 'packages/utils/src/versions/versionMatrix.json');

// Simple copy from source to root (just for repo clarity)
try {
  const matrix = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const targetPath = join(rootDir, 'version-matrix.json');
  writeFileSync(targetPath, JSON.stringify(matrix, null, 2));
  console.log('Version matrix updated successfully');
} catch (error) {
  console.error('Error updating version matrix:', error);
  process.exit(1);
}