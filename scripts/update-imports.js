const fs = require('fs');
const path = require('path');
const glob = require('glob');

const walletDistDir = path.join(__dirname, '../packages/wallet/dist');

// Find all js files in wallet dist
const files = glob.sync(`${walletDistDir}/**/*.js`);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
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
  
  fs.writeFileSync(file, content);
});

console.log(`Updated imports in ${files.length} files`);