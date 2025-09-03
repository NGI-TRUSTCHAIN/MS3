import {logger} from '../logger.js';
import { fileURLToPath } from "url";

logger.notice("BumpVersion.ts: Script execution started");

async function runBumpProcess() {
  logger.notice("BumpVersion.ts: runBumpProcess() started");

  // Dynamic imports
  const fsModule = await import("fs");
  const fs = fsModule.default;

  const pathModule = await import("path");
  const { resolve, join, dirname } = pathModule;

  const urlModule = await import("url");
  const { fileURLToPath } = urlModule;

  const childProcessModule = await import("child_process");
  const { execSync } = childProcessModule;

  const scriptPath = fileURLToPath(import.meta.url);
  const currentDir = dirname(scriptPath);
  const rootDir = resolve(currentDir, '..');

  // Parse CLI arguments
  const args = process.argv.slice(2);
  const packageName = args.find(arg => !arg.startsWith('--'));
  const bumpType = args.includes('--major') ? 'major' :
    args.includes('--minor') ? 'minor' : 'patch';

  if (!packageName) {
    logger.crit("BumpVersion.ts: ERROR - Package name required");
    logger.notice("Usage: node bump-version.ts <package-name> [--major|--minor|--patch]");
    process.exit(1);
  }

  logger.notice(`BumpVersion.ts: Bumping ${packageName} with ${bumpType} increment`);

  // Validate package exists
  const packagePath = join(rootDir, 'packages', packageName);
  const packageJsonPath = join(packagePath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    logger.crit(`BumpVersion.ts: ERROR - Package '${packageName}' not found at ${packageJsonPath}`);
    process.exit(1);
  }

  // Read current version
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const currentVersion = packageJson.version;
  const fullPackageName = packageJson.name;

  logger.info(`BumpVersion.ts: Current version of ${fullPackageName}: ${currentVersion}`);

  // Parse and bump version (Standard A)
  const versionParts = currentVersion.split('.').map(Number);
  let newVersion: string;

  switch (bumpType) {
    case 'major':
      newVersion = `${versionParts[0] + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${versionParts[0]}.${versionParts[1] + 1}.0`;
      break;
    case 'patch':
      newVersion = `${versionParts[0]}.${versionParts[1]}.${versionParts[2] + 1}`;
      break;
    default:
      throw new Error(`Invalid bump type: ${bumpType}`);
  }

  // Optional: Check against published NPM versions (basic check)
  try {
    const npmViewResult = execSync(`npm view ${fullPackageName} versions --json`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const publishedVersions = JSON.parse(npmViewResult);

    if (Array.isArray(publishedVersions) && publishedVersions.includes(newVersion)) {
      logger.error(`BumpVersion.ts: ERROR - Version ${newVersion} already published for ${fullPackageName}`);
      process.exit(1);
    }
  } catch (error) {
    logger.warning(`BumpVersion.ts: Could not check published versions (package might not exist on NPM yet): ${error}`);
  }

  // Update package.json
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  logger.notice(`BumpVersion.ts: ✅ Version bumped from ${currentVersion} to ${newVersion} for ${fullPackageName}`);

  return newVersion;
}

// Main execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runBumpProcess().catch(error => {
    logger.emerg("BumpVersion.ts: CRITICAL ERROR:");
    logger.error(error?.message);
    process.exit(1);
  });
}

export { runBumpProcess };