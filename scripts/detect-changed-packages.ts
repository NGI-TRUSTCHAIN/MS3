import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function safeExec(cmd: string) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function gitFetchMain() {
  try {
    execSync('git fetch origin main --depth=2', { stdio: 'ignore' });
  } catch {
    // ignore fetch failures in some shallow CI setups
  }
}

function getChangedFiles(): string[] {
  gitFetchMain();

  // prefer origin/main if exists
  const hasOriginMain = safeExec('git rev-parse --verify origin/main') !== '';

  let diffRange = '';
  if (hasOriginMain) {
    diffRange = 'origin/main...HEAD';
  } else {
    // ensure HEAD has a parent before using HEAD~1
    const headParent = safeExec('git rev-parse --verify HEAD~1');
    if (headParent) {
      diffRange = 'HEAD~1...HEAD';
    } else {
      // no history to diff against (fresh shallow clone) -> return all tracked files
      const all = safeExec('git ls-files');
      return all ? all.split(/\r?\n/) : [];
    }
  }

  const changed = safeExec(`git diff --name-only ${diffRange}`);
  if (!changed) {
    // if diff produced nothing (or command failed) fall back to last commit files
    const last = safeExec('git show --name-only --pretty="" HEAD');
    return last ? last.split(/\r?\n/).filter(Boolean) : [];
  }
  return changed ? changed.split(/\r?\n/).filter(Boolean) : [];
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

const changedFiles = getChangedFiles();
const changedPkgs = detectPackagesFromFiles(changedFiles);
const list = changedPkgs.join(',') || '';
console.log('Changed packages detected:', list || '(none)');
setAzureVariable('CHANGED_PACKAGES', list);
process.exit(0);