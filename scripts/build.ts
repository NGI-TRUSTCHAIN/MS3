// FOR THIS TO WORK, FIRST BUILD SHARED PACKAGE.
import { Ms3Modules } from '@m3s/shared';
import {logger} from '../logger.js';
import fs from 'fs';
import { join } from 'path';

logger.debug("Script execution started.");

async function runBuildProcess() {
  logger.info("Build process started.");

  // Dynamically import modules
  const fsModule = await import("fs");
  const fs = fsModule.default; // CommonJS modules often have exports under 'default' when dynamically imported
  logger.debug("fs module imported.");

  const pathModule = await import("path");
  const { resolve, join, dirname } = pathModule;
  logger.debug("path module imported.");

  const urlModule = await import("url");
  const { fileURLToPath } = urlModule;
  logger.debug("url module imported.");

  const childProcessModule = await import("child_process");
  const { execSync } = childProcessModule;
  logger.debug("child_process module imported.");

  const scriptPath = fileURLToPath(import.meta.url);
  const currentDir = dirname(scriptPath);
  const rootDir = resolve(currentDir, '..');
  logger.debug(`Paths initialized. rootDir: ${rootDir}`);

  async function buildPackage(packageName: string) {
    logger.info(`Building package: ${packageName}`);
    const pkgPath = join(rootDir, `packages/${packageName}`);
    const pkgJsonPath = join(pkgPath, 'package.json');

    if (!fs.existsSync(pkgJsonPath)) {
      logger.crit(`[${packageName}] package.json not found at ${pkgJsonPath}`);
      process.exit(1);
    }
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    const distDir = join(pkgPath, 'dist');
    const tsconfigPath = join(pkgPath, 'tsconfig.json');

    logger.debug(`Preparing build for ${packageName}`);

    // Ensure shared is built first if needed
    if (packageName !== Ms3Modules.shared) {
      const sharedDistPath = join(rootDir, 'packages/shared/dist');
      const sharedIndexDts = join(sharedDistPath, 'index.d.ts');

      if (!fs.existsSync(sharedIndexDts)) {
        logger.info(`[${packageName}] Shared types not found. Building shared first...`);
        await buildPackage(Ms3Modules.shared);
      } else {
        // Check if shared source is newer than built types
        const sharedSrcPath = join(rootDir, 'packages/shared/src');
        const sharedSrcMtime = getLatestFileTime(sharedSrcPath);
        const sharedDistMtime = fs.statSync(sharedIndexDts).mtime;

        if (sharedSrcMtime > sharedDistMtime) {
          logger.info(`[${packageName}] Shared source is newer than built types. Rebuilding shared...`);
          await buildPackage(Ms3Modules.shared);
        }
      }
    }

    // 1. Clean dist directory
    if (fs.existsSync(distDir)) {
      logger.info(`[${packageName}] Cleaning dist directory: ${distDir}`);
      fs.rmSync(distDir, { recursive: true, force: true });
    }
    fs.mkdirSync(distDir, { recursive: true });

    // ✅ ENHANCED: Clean all build artifacts for this package
    const tsbuildInfoPath = join(pkgPath, 'tsconfig.tsbuildinfo');
    if (fs.existsSync(tsbuildInfoPath)) {
      logger.info(`[${packageName}] Cleaning ${tsbuildInfoPath}`);
      fs.rmSync(tsbuildInfoPath, { force: true });
    }

    // TypeScript Compilation
    logger.info(`[${packageName}] Compiling TypeScript...`);
    try {
      // Do not force rebuild if possible ?
      // execSync(`npx tsc --build ${tsconfigPath} --force --verbose`, { stdio: "inherit", cwd: pkgPath });
      execSync(`npx tsc --build ${tsconfigPath} --verbose`, { stdio: "inherit", cwd: pkgPath });
      logger.notice(`[${packageName}] TypeScript compilation finished.`);
    } catch (err: any) {
      logger.error(`[${packageName}] TypeScript compilation failed: ${err.message}`);
      process.exit(1);
    }

    const expectedDtsPath = join(distDir, 'index.d.ts');
    if (!fs.existsSync(expectedDtsPath)) {
      logger.warning(`[${packageName}] WARNING: Declaration file ${expectedDtsPath} was NOT found after tsc.`);
    } else {
      logger.info(`[${packageName}] Declaration file ${expectedDtsPath} found.`);

      // ✅ VERIFY: Check if NetworkConfig has decimals field
      if (packageName === Ms3Modules.shared) {
        const dtsContent = fs.readFileSync(expectedDtsPath, 'utf-8');
        if (dtsContent.includes('interface NetworkConfig') && dtsContent.includes('decimals:')) {
          logger.notice(`[${packageName}] ✅ Verified: NetworkConfig includes decimals field in generated types`);
        } else {
          logger.warning(`[${packageName}] ⚠️  WARNING: NetworkConfig missing decimals field in generated types!`);
        }
      }
    }

    // 3. esbuild bundling (unchanged)
    if (packageName !== Ms3Modules.shared) {
      const tscEntryPoint = join(distDir, 'index.js');
      if (!fs.existsSync(tscEntryPoint)) {
        logger.crit(`[${packageName}] TSC output entry point ${tscEntryPoint} not found. Cannot bundle.`);
        process.exit(1);
      }
      logger.info(`[${packageName}] Bundling with esbuild from ${tscEntryPoint}...`);

      let externalDependencies = Object.keys(pkgJson.dependencies || {})
        .filter(dep => dep !== '@m3s/shared');

      if (pkgJson.peerDependencies) {
        externalDependencies.push(...Object.keys(pkgJson.peerDependencies));
      }

      if (pkgJson.peerDependenciesMeta) {
        externalDependencies.push(...Object.keys(pkgJson.peerDependenciesMeta));
      }

if (packageName !== Ms3Modules.shared) {
  // Read shared package.json dependencies
  const sharedPkgJsonPath = join(rootDir, 'packages/shared/package.json');
  const sharedPkgJson = JSON.parse(fs.readFileSync(sharedPkgJsonPath, 'utf-8'));
  const sharedDeps = Object.keys(sharedPkgJson.dependencies || {});
  // Add all shared dependencies as externals (except @m3s/shared itself)
  externalDependencies.push(...sharedDeps.filter(dep => dep !== '@m3s/shared'));
}

      const externalArgs = externalDependencies.map(dep => `--external:${dep}`).join(' ');

      let platform = 'neutral';

      if (packageName === Ms3Modules.smartcontract) {
        platform = 'node';
        logger.debug(`[${packageName}] Using --platform=node for esbuild because it's a Node.js-specific package.`);
      }

      const esbuildBaseCmd = `npx esbuild "${tscEntryPoint}" --bundle --platform=${platform} --target=es2020 ${externalArgs} --sourcemap`;

      const esmOutfile = join(distDir, `index.esm.js`);
      execSync(`${esbuildBaseCmd} --format=esm --outfile="${esmOutfile}"`, { stdio: "inherit", cwd: rootDir });
      logger.info(`[${packageName}] ESM bundle created: ${esmOutfile}`);

      const cjsOutfile = join(distDir, `index.cjs.js`);
      execSync(`${esbuildBaseCmd} --format=cjs --outfile="${cjsOutfile}"`, { stdio: "inherit", cwd: rootDir });
      logger.info(`[${packageName}] CJS bundle created: ${cjsOutfile}`);
    } else {
      logger.info(`[${packageName}] 'shared' package built with tsc. No esbuild bundling for shared.`);
    }

    logger.info(`[${packageName}] Build completed successfully.`);
  }

  async function buildAll() {
    logger.info("Building all packages...");

    // ✅ ENHANCED: Always clean all build artifacts first
    const packagesOrder = [Ms3Modules.shared, Ms3Modules.wallet, Ms3Modules.crosschain, Ms3Modules.smartcontract];

    logger.debug("Cleaning all build artifacts...");
    for (const pkg of packagesOrder) {
      const pkgPath = join(rootDir, `packages/${pkg}`);
      const distPath = join(pkgPath, 'dist');
      const tsbuildInfoPath = join(pkgPath, 'tsconfig.tsbuildinfo');

      if (fs.existsSync(distPath)) {
        logger.debug(`[${pkg}] Cleaning ${distPath}`);
        fs.rmSync(distPath, { recursive: true, force: true });
      }

      if (fs.existsSync(tsbuildInfoPath)) {
        logger.debug(`[${pkg}] Cleaning ${tsbuildInfoPath}`);
        fs.rmSync(tsbuildInfoPath, { force: true });
      }
    }

    logger.info("Starting build for all packages...");
    for (const pkg of packagesOrder) {
      await buildPackage(pkg);
    }
    logger.info("All packages built successfully.");
  }

  // Main module execution logic
  logger.debug("Checking main module condition.");
  if (process.argv[1] === scriptPath) {
    logger.debug("Script is main module.");
    const packageNameArg = process.argv[2];
    logger.debug(`Package name argument: ${packageNameArg}`);

    if (packageNameArg) {
      logger.info(`Building single package: ${packageNameArg}`);
      const pkgTsBuildInfoPath = join(rootDir, `packages/${packageNameArg}`, 'tsconfig.tsbuildinfo');
      if (fs.existsSync(pkgTsBuildInfoPath)) {
        logger.debug(`[${packageNameArg}] Cleaning ${pkgTsBuildInfoPath} before single build.`);
        fs.rmSync(pkgTsBuildInfoPath, { force: true });
      }
      await buildPackage(packageNameArg);
    } else {
      logger.info("No package name provided, building all.");
      await buildAll();
    }
    logger.info("Script operations finished successfully.");
  } else {
    logger.info("Script is NOT main module.");
    logger.warning(`Mismatch - process.argv[1]: ${process.argv[1]}`);
    logger.warning(`Mismatch - scriptPath from import.meta.url: ${scriptPath}`);
  }
}

// ✅ NEW: Helper function to get latest file modification time recursively
function getLatestFileTime(dirPath: string): Date {
  let latestTime = new Date(0);

  function scanDir(currentPath: string) {
    const items = fs.readdirSync(currentPath);
    for (const item of items) {
      const itemPath = join(currentPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory() && item !== 'node_modules' && item !== 'dist') {
        scanDir(itemPath);
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.js'))) {
        if (stat.mtime > latestTime) {
          latestTime = stat.mtime;
        }
      }
    }
  }

  scanDir(dirPath);
  return latestTime;
}

// Execute the build process and catch any unhandled errors
runBuildProcess().catch(error => {
  logger.emerg("Build.ts: CRITICAL UNHANDLED ERROR in runBuildProcess()");
  if (error instanceof Error) {
    logger.error(`Build.ts: Error message: ${error.message}`);
    logger.error(`Build.ts: Error stack: ${error.stack}`);
  } else {
    logger.error(`Build.ts: Non-Error thrown: ${JSON.stringify(error, null, 2)}`);
  }
  process.exit(1);
});