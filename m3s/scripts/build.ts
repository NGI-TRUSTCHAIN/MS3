console.log("Build.ts: Script execution started - Top Level Log");

async function runBuildProcess() {
  console.log("Build.ts: runBuildProcess() started.");

  // Dynamically import modules
  const fsModule = await import("fs");
  const fs = fsModule.default; // CommonJS modules often have exports under 'default' when dynamically imported
  console.log("Build.ts: 'fs' module imported.");

  const pathModule = await import("path");
  const { resolve, join, dirname } = pathModule;
  console.log("Build.ts: 'path' module imported.");

  const urlModule = await import("url");
  const { fileURLToPath } = urlModule;
  console.log("Build.ts: 'url' module imported.");

  const childProcessModule = await import("child_process");
  const { execSync } = childProcessModule;
  console.log("Build.ts: 'child_process' module imported.");

  const scriptPath = fileURLToPath(import.meta.url);
  const currentDir = dirname(scriptPath);
  const rootDir = resolve(currentDir, '..');
  console.log("Build.ts: Paths initialized. rootDir:", rootDir);

  async function buildPackage(packageName: string) {
    console.log(`Build.ts: buildPackage('${packageName}') started.`);
    const pkgPath = join(rootDir, `packages/${packageName}`);
    const pkgJsonPath = join(pkgPath, 'package.json');

    if (!fs.existsSync(pkgJsonPath)) {
      console.error(`[${packageName}] package.json not found at ${pkgJsonPath}`);
      process.exit(1);
    }
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    const distDir = join(pkgPath, 'dist');
    const tsconfigPath = join(pkgPath, 'tsconfig.json');

    console.log(`\n=== Building ${packageName} ===`);

    // 1. Clean dist directory
    if (fs.existsSync(distDir)) {
      console.log(`[${packageName}] Cleaning dist directory: ${distDir}`);
      fs.rmSync(distDir, { recursive: true, force: true });
    }
    fs.mkdirSync(distDir, { recursive: true });

    // 2. TypeScript Compilation
    console.log(`[${packageName}] Building package and its dependencies with tsc --build...`);
    execSync(`npx tsc --build ${tsconfigPath} --verbose --listEmittedFiles`, { stdio: "inherit", cwd: pkgPath });
    console.log(`[${packageName}] TypeScript compilation step finished.`);

    const expectedDtsPath = join(distDir, 'index.d.ts');
    if (!fs.existsSync(expectedDtsPath)) {
      console.warn(`[${packageName}] WARNING: Declaration file ${expectedDtsPath} was NOT found after tsc.`);
    } else {
      console.log(`[${packageName}] Declaration file ${expectedDtsPath} found.`);
    }

    // 3. esbuild bundling
    if (packageName !== 'common') {
      const tscEntryPoint = join(distDir, 'index.js');
      if (!fs.existsSync(tscEntryPoint)) {
        console.error(`[${packageName}] TSC output entry point ${tscEntryPoint} not found. Cannot bundle.`);
        process.exit(1);
      }
      console.log(`[${packageName}] Bundling with esbuild from ${tscEntryPoint}...`);

      let externalDependencies = Object.keys(pkgJson.dependencies || {})
        .filter(dep => dep !== '@m3s/common'); 

      if (pkgJson.peerDependencies) {
        externalDependencies.push(...Object.keys(pkgJson.peerDependencies));
      }
      externalDependencies = externalDependencies.filter(dep => dep !== '@m3s/common');
      
      const externalArgs = externalDependencies.map(dep => `--external:${dep}`).join(' ');


     // Determine platform based on package name
      let platform = 'neutral'; // Default platform
      if (packageName === 'smart-contract') {
        platform = 'node';
        console.log(`[${packageName}] Using --platform=node for esbuild because it's a Node.js-specific package.`);
      }
      
      // Add other package-specific platform adjustments if needed:
      // else if (packageName === 'wallet' || packageName === 'crosschain') {
      //   platform = 'browser'; // Or 'neutral' if they are environment-agnostic
      // }

      const esbuildBaseCmd = `npx esbuild "${tscEntryPoint}" --bundle --platform=${platform} --target=es2020 ${externalArgs} --sourcemap`;

      const esmOutfile = join(distDir, `index.esm.js`);
      execSync(`${esbuildBaseCmd} --format=esm --outfile="${esmOutfile}"`, { stdio: "inherit", cwd: rootDir });
      console.log(`[${packageName}] ESM bundle created: ${esmOutfile}`);

      const cjsOutfile = join(distDir, `index.cjs.js`);
      execSync(`${esbuildBaseCmd} --format=cjs --outfile="${cjsOutfile}"`, { stdio: "inherit", cwd: rootDir });
      console.log(`[${packageName}] CJS bundle created: ${cjsOutfile}`);
    } else {
      console.log(`[${packageName}] 'common' package built with tsc. JS and .d.ts files are in its dist directory. No esbuild bundling for common itself.`);
    }

    console.log(`[${packageName}] Successfully built.`);
  }

  async function buildAll() {
    console.log("Build.ts: buildAll() started.");
    const packagesOrder = ['common', 'wallet', 'crosschain', 'smart-contract'];
    console.log("Starting build for all packages...");
    for (const pkg of packagesOrder) {
      const pkgTsBuildInfoPath = join(rootDir, `packages/${pkg}`, 'tsconfig.tsbuildinfo');
      if (fs.existsSync(pkgTsBuildInfoPath)) {
        console.log(`[${pkg}] Cleaning ${pkgTsBuildInfoPath} before build.`);
        fs.rmSync(pkgTsBuildInfoPath, { force: true });
      }
      await buildPackage(pkg);
    }
    console.log("\n✓ All packages built successfully.");
  }

  // Main module execution logic
  console.log("Build.ts: Checking main module condition.");
  if (process.argv[1] === scriptPath) {
    console.log("Build.ts: Script is main module.");
    const packageNameArg = process.argv[2];
    console.log("Build.ts: Package name argument:", packageNameArg);

    if (packageNameArg) {
      console.log(`Build.ts: Proceeding to build single package: ${packageNameArg}`);
      const pkgTsBuildInfoPath = join(rootDir, `packages/${packageNameArg}`, 'tsconfig.tsbuildinfo');
      if (fs.existsSync(pkgTsBuildInfoPath)) {
        console.log(`[${packageNameArg}] Cleaning ${pkgTsBuildInfoPath} before single build.`);
        fs.rmSync(pkgTsBuildInfoPath, { force: true });
      }
      await buildPackage(packageNameArg);
    } else {
      console.log("Build.ts: No package name provided, building all.");
      await buildAll();
    }
    console.log("Build.ts: Script operations finished successfully.");
  } else {
    console.log("Build.ts: Script is NOT main module.");
    console.log("Build.ts: Mismatch - process.argv[1]:", process.argv[1]);
    console.log("Build.ts: Mismatch - scriptPath from import.meta.url:", scriptPath);
  }
}

// Execute the build process and catch any unhandled errors
runBuildProcess().catch(error => {
  console.error("Build.ts: CRITICAL UNHANDLED ERROR in runBuildProcess()");
  console.error("Build.ts: Error message:", error?.message);
  console.error("Build.ts: Error stack:", error?.stack);
  if (!(error instanceof Error) && error !== null) {
    try {
      console.error("Build.ts: Full error object (raw):", error);
      console.error("Build.ts: Full error object (JSON.stringify):", JSON.stringify(error, null, 2));
    } catch (stringifyError) {
      console.error("Build.ts: Could not stringify the error object:", stringifyError);
    }
  }
  process.exit(1);
});