import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pkg from 'glob';
const { sync } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const walletDistDir = join(__dirname, '../packages/wallet/dist');

// Find all js files in wallet dist
const files = sync(`${walletDistDir}/**/*.js`);

files.forEach(file => {
  let content = readFileSync(file, 'utf8');
  
  // Replace import paths
  content = content.replace(
    /from ['"]@m3s\/utils(\/.*)?['"]/g, 
    (match, subpath) => {
      if (subpath) {
        return `from "../utils${subpath}"`;
      }
      return `from "../utils"`;
    }
  );
  
  writeFileSync(file, content);
});

console.log(`Updated imports in ${files.length} files`);