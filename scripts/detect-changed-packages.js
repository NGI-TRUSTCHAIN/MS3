const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function gitFetchMain() {
  try {
    execSync('git fetch origin main --depth=1', { stdio: 'ignore' });
  } catch (e) {
    // ignore fetch failures in some shallow CI setups
  }
}

function getChangedFiles() {
  // compare against origin/main if available, otherwise HEAD~1
  let diffRange = 'origin/main...HEAD';
  try {
    const out = execSync(`git rev-parse --verify origin/main`, { stdio: 'ignore' });
  } catch {
    diffRange = 'HEAD~1...HEAD';
  }
  const changed = execSync(`git diff --name-only ${diffRange}`, { encoding: 'utf8' }).trim();
  return changed ? changed.split(/\r?\n/) : [];
}

function detectPackagesFromFiles(files) {
  const pkgDir = path.join(process.cwd(), 'packages');
  const packages = new Set();
  const folderNames = fs.existsSync(pkgDir) ? fs.readdirSync(pkgDir) : [];

  for (const file of files) {
    for (const folder of folderNames) {
      if (file.startsWith(`packages/${folder}/`) || file === `packages/${folder}`) {
        packages.add(folder);
      }
    }
    // if top-level files changed (package.json, README, scripts) mark all packages
    if (file === 'package.json' || file.startsWith('scripts/') || file.startsWith('.github/')) {
      folderNames.forEach(f => packages.add(f));
    }
  }
  return Array.from(packages);
}

function setAzureVariable(name, value) {
  // Azure DevOps pipeline logging command to set variable
  console.log(`##vso[task.setvariable variable=${name};isOutput=true]${value}`);
}

// Main
gitFetchMain();
const changedFiles = getChangedFiles();
const changedPkgs = detectPackagesFromFiles(changedFiles);
const list = changedPkgs.join(',') || '';
console.log('Changed packages detected:', list || '(none)');
setAzureVariable('CHANGED_PACKAGES', list);
process.exit(0);