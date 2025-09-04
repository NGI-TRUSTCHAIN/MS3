import {logger} from '../logger.js';

enum Ms3Modules {
  'shared' = 'shared',
  'wallet' = 'wallet',
  'smartcontract' = 'smart-contract',
  'crosschain' = 'crosschain'
}

logger.notice("Publish.ts: Script execution started - Top Level Log");

async function runPublishProcess() {
  logger.notice("Publish.ts: runPublishProcess() started.");

  // Dynamically import modules
  const fsModule = await import("fs");
  const fs = fsModule.default;
  logger.debug("Publish.ts: 'fs' module imported.");

  const pathModule = await import("path");
  const { resolve, join, dirname } = pathModule;
  logger.debug("Publish.ts: 'path' module imported.");

  const urlModule = await import("url");
  const { fileURLToPath } = urlModule;
  logger.debug("Publish.ts: 'url' module imported.");

  const childProcessModule = await import("child_process");
  const { execSync } = childProcessModule;
  logger.debug("Publish.ts: 'child_process' module imported.");

  const scriptPath = fileURLToPath(import.meta.url);
  const currentDir = dirname(scriptPath);
  const rootDir = resolve(currentDir, '..');
  logger.debug("Publish.ts: Paths initialized. rootDir:", rootDir);

  function updateDependentPackages(packageName: string, version: string) {
    logger.info(`Publish.ts: updateDependentPackages for published package ${packageName}@${version} started.`);
    const packagesDir = join(rootDir, 'packages');
    const publishedScopedPackageName = `@m3s/${packageName}`;

    try {
      const allPackageDirs = fs.readdirSync(packagesDir)
        .filter(dir => dir !== Ms3Modules.shared && dir !== packageName);

      allPackageDirs.forEach(pkgDir => {
        const dependentPkgJsonPath = join(packagesDir, pkgDir, 'package.json');
        if (fs.existsSync(dependentPkgJsonPath)) {
          const dependentPkgJson = JSON.parse(fs.readFileSync(dependentPkgJsonPath, 'utf8'));

          let updated = false;
          if (dependentPkgJson.dependencies && dependentPkgJson.dependencies[publishedScopedPackageName]) {
            dependentPkgJson.dependencies[publishedScopedPackageName] = `^${version}`;
            updated = true;
          }
          if (dependentPkgJson.devDependencies && dependentPkgJson.devDependencies[publishedScopedPackageName]) {
            dependentPkgJson.devDependencies[publishedScopedPackageName] = `^${version}`;
            updated = true;
          }

          if (updated) {
            fs.writeFileSync(dependentPkgJsonPath, JSON.stringify(dependentPkgJson, null, 2) + '\n');
            logger.notice(`[Publish.ts] Updated ${dependentPkgJson.name}'s dependency on ${publishedScopedPackageName} to ^${version}`);
          }
        }
      });
    } catch (error) {
      logger.error("Publish.ts: Error in updateDependentPackages:", error);
    }
  }

  async function publishPackage(packageName: string, options: { otp?: string } = {}) {
    logger.notice(`Publish.ts: publishPackage('${packageName}') started.`);
    
    // ✅ NEW: Check for version bump flags
    const args = process.argv.slice(2);
    const shouldBumpMajor = args.includes('--major');
    const shouldBumpMinor = args.includes('--minor');
    const shouldBumpPatch = args.includes('--patch');
    
    // ✅ NEW: Run bump script if flags provided
    if (shouldBumpMajor || shouldBumpMinor || shouldBumpPatch) {
      logger.notice(`Publish.ts: Version bump requested for ${packageName}`);
      
      const bumpType = shouldBumpMajor ? '--major' : shouldBumpMinor ? '--minor' : '--patch';
      const versionScriptPath = join(rootDir, 'scripts', 'version.ts');
      
      try {
        execSync(`node --loader ts-node/esm "${versionScriptPath}" ${packageName} ${bumpType}`, { 
          stdio: 'inherit', 
          cwd: rootDir 
        });
        logger.notice(`Publish.ts: Version bump completed for ${packageName}`);
      } catch (bumpError) {
             logger.crit(`Publish.ts: Failed to bump version for ${packageName}. Error: ${bumpError}`);
        process.exit(1);
      }
    }

    const packagePath = join(rootDir, 'packages', packageName);
    const packageJsonPath = join(packagePath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      logger.error(`[${packageName}] package.json not found at ${packageJsonPath}. Cannot publish.`);
      process.exit(1);
    }

    // ✅ UPDATED: Read current version (after potential bump)
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const currentVersion = packageJson.version;
    const fullPackageName = packageJson.name;
    logger.info(`[${packageName}] Current version of ${fullPackageName}: ${currentVersion}`);

    logger.info(`[${packageName}] Cleaning build artifacts before fresh build...`);
    const distPath = join(packagePath, 'dist');
    const tsbuildInfoPath = join(packagePath, 'tsconfig.tsbuildinfo');

    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true, force: true });
    }
    if (fs.existsSync(tsbuildInfoPath)) {
      fs.rmSync(tsbuildInfoPath, { force: true });
    }

    // Build the package
    logger.info(`[${packageName}] Building package ${packageName} before publishing...`);
    try {
      execSync(`node --loader ts-node/esm "${join(rootDir, 'scripts', 'build.ts')}" ${packageName}`, { stdio: 'inherit', cwd: rootDir });
      logger.notice(`[${packageName}] Build completed successfully.`);
    } catch (buildError) {
      logger.crit(`[${packageName}] Failed to build package ${packageName}. Error: ${buildError}`);
      process.exit(1);
    }

    // 3. Publish to NPM
    const publishCmd = `npm publish --access public${options.otp ? ` --otp=${options.otp}` : ''}`;
    logger.notice(`[${packageName}] Publishing ${fullPackageName}@${currentVersion} with command: ${publishCmd}`);
    try {
      execSync(publishCmd, { cwd: packagePath, stdio: 'inherit' });
      logger.notice(`[${packageName}] Successfully published ${fullPackageName}@${currentVersion}`);
    } catch (error: any) {
      logger.crit(`[${packageName}] Failed to publish ${fullPackageName}@${currentVersion}. Error: ${error.message}`);
      if (error.stdout) logger.error("Stdout:", error.stdout.toString());
      if (error.stderr) logger.error("Stderr:", error.stderr.toString());
      process.exit(1);
    }

    // 4. Update dependent packages in the monorepo
    updateDependentPackages(packageName, currentVersion);

    // 5. Commit and tag
    logger.notice(`[${packageName}] Committing and tagging version ${currentVersion} for ${fullPackageName}...`);
    try {
      execSync(`git add "${packageJsonPath}"`, { cwd: rootDir, stdio: 'inherit' });
      execSync(`git add "${join(rootDir, 'package-lock.json')}"`, { cwd: rootDir, stdio: 'inherit' });
      execSync(`git commit -m "Publish ${fullPackageName}@${currentVersion}"`, { cwd: rootDir, stdio: 'inherit' });
      execSync(`git tag ${fullPackageName}@${currentVersion}`, { cwd: rootDir, stdio: 'inherit' });
      logger.notice(`[${packageName}] Git commit and tag created for ${fullPackageName}@${currentVersion}`);
    } catch (error: any) {
      logger.warning(`[${packageName}] Failed to commit or tag version for ${fullPackageName}. This might be okay if not in a git repo or if there are no changes. Error: ${error.message}`);
    }
    return currentVersion;
  }

  function getPublishablePackages() {
    logger.info("Publish.ts: getPublishablePackages() started.");
    const packagesDir = join(rootDir, 'packages');
    return fs.readdirSync(packagesDir)
      .filter(dir => {
        const pkgJsonPath = join(packagesDir, dir, 'package.json');
        if (!fs.existsSync(pkgJsonPath)) return false;
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        return !pkgJson.private;
      });
  }

  async function publishAllPackages(options: { otp?: string } = {}) {
    logger.notice("Publish.ts: publishAllPackages() started.");

    const orderedPackagesToPublish = [Ms3Modules.shared, Ms3Modules.wallet, Ms3Modules.smartcontract, Ms3Modules.crosschain];
    const allAllowedToPublish = getPublishablePackages();
    const packagesToActuallyPublish = orderedPackagesToPublish.filter(pkgName => allAllowedToPublish.includes(pkgName));

    if (packagesToActuallyPublish.length === 0) {
      logger.warning("No packages found in the defined order that are eligible for publishing.");
      return;
    }

    logger.notice(`\n🚀 Starting publishing process for: ${packagesToActuallyPublish.join(', ')}`);

    for (const pkgName of packagesToActuallyPublish) {
      await publishPackage(pkgName, options);
    }

    logger.notice("\n✅ All selected packages processed for publishing with fresh types.");
  }

  // ✅ UPDATED: Clean argument parsing
  logger.info("Publish.ts: Checking main module condition.");
  if (process.argv[1] === scriptPath) {
    logger.info("Publish.ts: Script is main module.");
    
    // ✅ NEW: Clean argument parsing using slice(2)
    const args = process.argv.slice(2);
    const packageNameArg = args.find(arg => !arg.startsWith('--'));
    const otpArg = process.env.NPM_OTP || args.find(arg => arg.startsWith('--otp='))?.split('=')[1];
    
    logger.info("Publish.ts: All arguments:", args);
    logger.info("Publish.ts: Package name argument:", packageNameArg);
    logger.info("Publish.ts: OTP argument (from env or CLI):", otpArg ? "Provided" : "Not provided");

    if (packageNameArg) {
      logger.notice(`Publish.ts: Proceeding to publish single package: ${packageNameArg}`);
      await publishPackage(packageNameArg, { otp: otpArg });
    } else {
      logger.notice("Publish.ts: No package name provided, publishing all eligible packages in order.");
      await publishAllPackages({ otp: otpArg });
    }
    logger.notice("Publish.ts: Script operations finished successfully.");
  } else {
    logger.info("Publish.ts: Script is NOT main module.");
  }
}

runPublishProcess().catch(error => {
  logger.emerg("Publish.ts: CRITICAL UNHANDLED ERROR in runPublishProcess()");
  logger.error("Publish.ts: Error message:", error?.message);
  logger.error("Publish.ts: Error stack:", error?.stack);
  if (!(error instanceof Error) && error !== null) {
   try {
      logger.error("Publish.ts: Full error object (raw):", error);
      logger.error("Publish.ts: Full error object (JSON.stringify):", JSON.stringify(error, null, 2));
    } catch (stringifyError) {
      logger.error("Publish.ts: Could not stringify the error object:", stringifyError);
    }
  }
  process.exit(1);
});