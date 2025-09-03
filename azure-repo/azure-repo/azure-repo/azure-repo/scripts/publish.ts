console.log("Publish.ts: Script execution started - Top Level Log");

async function runPublishProcess() {
  console.log("Publish.ts: runPublishProcess() started.");

  // Dynamically import modules
  const fsModule = await import("fs");
  const fs = fsModule.default;
  console.log("Publish.ts: 'fs' module imported.");

  const pathModule = await import("path");
  const { resolve, join, dirname } = pathModule;
  console.log("Publish.ts: 'path' module imported.");

  const urlModule = await import("url");
  const { fileURLToPath } = urlModule;
  console.log("Publish.ts: 'url' module imported.");

  const childProcessModule = await import("child_process");
  const { execSync } = childProcessModule;
  console.log("Publish.ts: 'child_process' module imported.");

  const scriptPath = fileURLToPath(import.meta.url);
  const currentDir = dirname(scriptPath);
  const rootDir = resolve(currentDir, '..');
  console.log("Publish.ts: Paths initialized. rootDir:", rootDir);

  function updateDependentPackages(packageName: string, version: string) {
    console.log(`Publish.ts: updateDependentPackages for published package ${packageName}@${version} started.`);
    const packagesDir = join(rootDir, 'packages');
    const publishedScopedPackageName = `@m3s/${packageName}`;

    try {
      const allPackageDirs = fs.readdirSync(packagesDir)
        .filter(dir => dir !== 'shared' && dir !== packageName);

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
            console.log(`[Publish.ts] Updated ${dependentPkgJson.name}'s dependency on ${publishedScopedPackageName} to ^${version}`);
          }
        }
      });
    } catch (error) {
      console.error("Publish.ts: Error in updateDependentPackages:", error);
    }
  }

  async function publishPackage(packageName: string, options: { otp?: string } = {}) {
    console.log(`Publish.ts: publishPackage('${packageName}') started.`);
    
    // ✅ NEW: Check for version bump flags
    const args = process.argv.slice(2);
    const shouldBumpMajor = args.includes('--major');
    const shouldBumpMinor = args.includes('--minor');
    const shouldBumpPatch = args.includes('--patch');
    
    // ✅ NEW: Run bump script if flags provided
    if (shouldBumpMajor || shouldBumpMinor || shouldBumpPatch) {
      console.log(`Publish.ts: Version bump requested for ${packageName}`);
      
      const bumpType = shouldBumpMajor ? '--major' : shouldBumpMinor ? '--minor' : '--patch';
      const versionScriptPath = join(rootDir, 'scripts', 'version.ts');
      
      try {
        execSync(`node --loader ts-node/esm "${versionScriptPath}" ${packageName} ${bumpType}`, { 
          stdio: 'inherit', 
          cwd: rootDir 
        });
        console.log(`Publish.ts: Version bump completed for ${packageName}`);
      } catch (bumpError) {
        console.error(`Publish.ts: Failed to bump version for ${packageName}. Error: ${bumpError}`);
        process.exit(1);
      }
    }

    const packagePath = join(rootDir, 'packages', packageName);
    const packageJsonPath = join(packagePath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      console.error(`[${packageName}] package.json not found at ${packageJsonPath}. Cannot publish.`);
      process.exit(1);
    }

    // ✅ UPDATED: Read current version (after potential bump)
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const currentVersion = packageJson.version;
    const fullPackageName = packageJson.name;
    console.log(`[${packageName}] Current version of ${fullPackageName}: ${currentVersion}`);

    console.log(`[${packageName}] Cleaning build artifacts before fresh build...`);
    const distPath = join(packagePath, 'dist');
    const tsbuildInfoPath = join(packagePath, 'tsconfig.tsbuildinfo');

    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true, force: true });
    }
    if (fs.existsSync(tsbuildInfoPath)) {
      fs.rmSync(tsbuildInfoPath, { force: true });
    }

    // Build the package
    console.log(`[${packageName}] Building package ${packageName} before publishing...`);
    try {
      execSync(`node --loader ts-node/esm "${join(rootDir, 'scripts', 'build.ts')}" ${packageName}`, { stdio: 'inherit', cwd: rootDir });
      console.log(`[${packageName}] Build completed successfully.`);
    } catch (buildError) {
      console.error(`[${packageName}] Failed to build package ${packageName}. Error: ${buildError}`);
      process.exit(1);
    }

    // ✅ REMOVED: Old hardcoded version bump logic (lines 97-109)
    // Version is now handled by the bump script above

    // 3. Publish to NPM
    const publishCmd = `npm publish --access public${options.otp ? ` --otp=${options.otp}` : ''}`;
    console.log(`[${packageName}] Publishing ${fullPackageName}@${currentVersion} with command: ${publishCmd}`);
    try {
      execSync(publishCmd, { cwd: packagePath, stdio: 'inherit' });
      console.log(`[${packageName}] Successfully published ${fullPackageName}@${currentVersion}`);
    } catch (error: any) {
      console.error(`[${packageName}] Failed to publish ${fullPackageName}@${currentVersion}. Error: ${error.message}`);
      if (error.stdout) console.error("Stdout:", error.stdout.toString());
      if (error.stderr) console.error("Stderr:", error.stderr.toString());
      process.exit(1);
    }

    // 4. Update dependent packages in the monorepo
    updateDependentPackages(packageName, currentVersion);

    // 5. Commit and tag
    console.log(`[${packageName}] Committing and tagging version ${currentVersion} for ${fullPackageName}...`);
    try {
      execSync(`git add "${packageJsonPath}"`, { cwd: rootDir, stdio: 'inherit' });
      execSync(`git add "${join(rootDir, 'package-lock.json')}"`, { cwd: rootDir, stdio: 'inherit' });
      execSync(`git commit -m "Publish ${fullPackageName}@${currentVersion}"`, { cwd: rootDir, stdio: 'inherit' });
      execSync(`git tag ${fullPackageName}@${currentVersion}`, { cwd: rootDir, stdio: 'inherit' });
      console.log(`[${packageName}] Git commit and tag created for ${fullPackageName}@${currentVersion}`);
    } catch (error: any) {
      console.warn(`[${packageName}] Failed to commit or tag version for ${fullPackageName}. This might be okay if not in a git repo or if there are no changes. Error: ${error.message}`);
    }
    return currentVersion;
  }

  function getPublishablePackages() {
    console.log("Publish.ts: getPublishablePackages() started.");
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
    console.log("Publish.ts: publishAllPackages() started.");

    const orderedPackagesToPublish = ['shared', 'wallet', 'smart-contract', 'crosschain'];
    const allAllowedToPublish = getPublishablePackages();
    const packagesToActuallyPublish = orderedPackagesToPublish.filter(pkgName => allAllowedToPublish.includes(pkgName));

    if (packagesToActuallyPublish.length === 0) {
      console.log("No packages found in the defined order that are eligible for publishing.");
      return;
    }

    console.log(`\n🚀 Starting publishing process for: ${packagesToActuallyPublish.join(', ')}`);

    for (const pkgName of packagesToActuallyPublish) {
      await publishPackage(pkgName, options);
    }

    console.log("\n✅ All selected packages processed for publishing with fresh types.");
  }

  // ✅ UPDATED: Clean argument parsing
  console.log("Publish.ts: Checking main module condition.");
  if (process.argv[1] === scriptPath) {
    console.log("Publish.ts: Script is main module.");
    
    // ✅ NEW: Clean argument parsing using slice(2)
    const args = process.argv.slice(2);
    const packageNameArg = args.find(arg => !arg.startsWith('--'));
    const otpArg = process.env.NPM_OTP || args.find(arg => arg.startsWith('--otp='))?.split('=')[1];
    
    console.log("Publish.ts: All arguments:", args);
    console.log("Publish.ts: Package name argument:", packageNameArg);
    console.log("Publish.ts: OTP argument (from env or CLI):", otpArg ? "Provided" : "Not provided");

    if (packageNameArg) {
      console.log(`Publish.ts: Proceeding to publish single package: ${packageNameArg}`);
      await publishPackage(packageNameArg, { otp: otpArg });
    } else {
      console.log("Publish.ts: No package name provided, publishing all eligible packages in order.");
      await publishAllPackages({ otp: otpArg });
    }
    console.log("Publish.ts: Script operations finished successfully.");
  } else {
    console.log("Publish.ts: Script is NOT main module.");
  }
}

runPublishProcess().catch(error => {
  console.error("Publish.ts: CRITICAL UNHANDLED ERROR in runPublishProcess()");
  console.error("Publish.ts: Error message:", error?.message);
  console.error("Publish.ts: Error stack:", error?.stack);
  if (!(error instanceof Error) && error !== null) {
    try {
      console.error("Publish.ts: Full error object (raw):", error);
      console.error("Publish.ts: Full error object (JSON.stringify):", JSON.stringify(error, null, 2));
    } catch (stringifyError) {
      console.error("Publish.ts: Could not stringify the error object:", stringifyError);
    }
  }
  process.exit(1);
});