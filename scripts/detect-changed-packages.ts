import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function gitFetchMain() {
  try {
    execSync('git fetch origin main --depth=1', { stdio: 'ignore' });
  } catch {
    // ignore fetch failures in some shallow CI setups
  }
}

function getChangedFiles(): string[] {
  let diffRange = 'origin/main...HEAD';
  try {
    execSync('git rev-parse --verify origin/main', { stdio: 'ignore' });
  } catch {
    diffRange = 'HEAD~1...HEAD';
  }
  const changed = execSync(`git diff --name-only ${diffRange}`, { encoding: 'utf8' }).trim();
  return changed ? changed.split(/\r?\n/) : [];
}

function detectPackagesFromFiles(files: string[]): string[] {
  const pkgDir = path.join(process.cwd(), 'packages');
  const packages = new Set<string>();
  const folderNames = fs.existsSync(pkgDir) ? fs.readdirSync(pkgDir) : [];

  for (const file of files) {
    for (const folder of folderNames) {
      if (file.startsWith(`packages/${folder}/`) || file === `packages/${folder}`) {
        packages.add(folder);
      }
    }
    if (file === 'package.json' || file.startsWith('scripts/') || file.startsWith('.github/')) {
      folderNames.forEach(f => packages.add(f));
    }
  }
  return Array.from(packages);
}

function setAzureVariable(name: string, value: string) {
  console.log(`##vso[task.setvariable variable=${name};isOutput=true]${value}`);
}

gitFetchMain();
const changedFiles = getChangedFiles();
const changedPkgs = detectPackagesFromFiles(changedFiles);
const list = changedPkgs.join(',') || '';
console.log('Changed packages detected:', list || '(none)');
setAzureVariable('CHANGED_PACKAGES', list);
process.exit(0);