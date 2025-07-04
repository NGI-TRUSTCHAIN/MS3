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
    // The full name of the package that was just published (e.g., @m3s/wallet)
    const publishedScopedPackageName = `@m3s/${packageName}`;

    try {
      const allPackageDirs = fs.readdirSync(packagesDir)
        .filter(dir => dir !== 'shared' && dir !== packageName); // Exclude shared and the package itself

      allPackageDirs.forEach(pkgDir => {
        const dependentPkgJsonPath = join(packagesDir, pkgDir, 'package.json');
        if (fs.existsSync(dependentPkgJsonPath)) {
          const dependentPkgJson = JSON.parse(fs.readFileSync(dependentPkgJsonPath, 'utf8'));

          let updated = false;
          // Check if this package (dependentPkgJson) depends on the publishedScopedPackageName
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
    const packagePath = join(rootDir, 'packages', packageName);
    const packageJsonPath = join(packagePath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      console.error(`[${packageName}] package.json not found at ${packageJsonPath}. Cannot publish.`);
      process.exit(1);
    }

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

    // 2. Bump version
    const versionParts = currentVersion.split('.').map(Number);
    versionParts[2]++; // Increment patch
    if (versionParts[2] > 9 && versionParts.length > 1) {
      versionParts[2] = 0;
      versionParts[1]++;
      if (versionParts[1] > 9 && versionParts.length > 0) {
        versionParts[1] = 0;
        versionParts[0]++;
      }
    }
    const newVersion = versionParts.join('.');
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`[${packageName}] Version bumped to ${newVersion} for ${fullPackageName}`);

    // 3. Publish to NPM
    const publishCmd = `npm publish --access public${options.otp ? ` --otp=${options.otp}` : ''}`;
    console.log(`[${packageName}] Publishing ${fullPackageName}@${newVersion} with command: ${publishCmd}`);
    try {
      execSync(publishCmd, { cwd: packagePath, stdio: 'inherit' });
      console.log(`[${packageName}] Successfully published ${fullPackageName}@${newVersion}`);
    } catch (error: any) {
      console.error(`[${packageName}] Failed to publish ${fullPackageName}@${newVersion}. Error: ${error.message}`);
      // Revert version bump on failure
      packageJson.version = currentVersion;
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(`[${packageName}] Reverted package.json to version ${currentVersion} for ${fullPackageName} due to publish error.`);
      if (error.stdout) console.error("Stdout:", error.stdout.toString());
      if (error.stderr) console.error("Stderr:", error.stderr.toString());
      process.exit(1);
    }
    // 4. Update dependent packages in the monorepo
    // Pass the simple name (e.g., "wallet") not "@m3s/wallet" to updateDependentPackages
    updateDependentPackages(packageName, newVersion);


    // 5. Commit and tag
    console.log(`[${packageName}] Committing and tagging version ${newVersion} for ${fullPackageName}...`);
    try {
      execSync(`git add "${packageJsonPath}"`, { cwd: rootDir, stdio: 'inherit' });
      // Also add package-lock.json if dependencies were updated
      execSync(`git add "${join(rootDir, 'package-lock.json')}"`, { cwd: rootDir, stdio: 'inherit' });
      execSync(`git commit -m "Publish ${fullPackageName}@${newVersion}"`, { cwd: rootDir, stdio: 'inherit' });
      execSync(`git tag ${fullPackageName}@${newVersion}`, { cwd: rootDir, stdio: 'inherit' });
      console.log(`[${packageName}] Git commit and tag created for ${fullPackageName}@${newVersion}`);
    } catch (error: any) {
      console.warn(`[${packageName}] Failed to commit or tag version for ${fullPackageName}. This might be okay if not in a git repo or if there are no changes. Error: ${error.message}`);
    }
    return newVersion; // Return the new version
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

    // ✅ ENHANCED: Always publish shared first, then dependents
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

  // Main module execution logic
  console.log("Publish.ts: Checking main module condition.");
  if (process.argv[1] === scriptPath) {
    console.log("Publish.ts: Script is main module.");
    const packageNameArg = process.argv[2];
    const otpArg = process.env.NPM_OTP || process.argv[3]; // Allow OTP from env or arg
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