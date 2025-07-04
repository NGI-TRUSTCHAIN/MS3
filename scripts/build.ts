console.log("Build.ts: Script execution started - Top Level Log");
import fs from 'fs';
import { join } from 'path';


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

    // ✅ CRITICAL FIX: Always ensure shared is built first if this package depends on it
    if (packageName !== 'shared') {
      const sharedDistPath = join(rootDir, 'packages/shared/dist');
      const sharedIndexDts = join(sharedDistPath, 'index.d.ts');

      if (!fs.existsSync(sharedIndexDts)) {
        console.log(`[${packageName}] Shared types not found. Building shared first...`);
        await buildPackage('shared');
      } else {
        // Check if shared source is newer than built types
        const sharedSrcPath = join(rootDir, 'packages/shared/src');
        const sharedSrcMtime = getLatestFileTime(sharedSrcPath);
        const sharedDistMtime = fs.statSync(sharedIndexDts).mtime;

        if (sharedSrcMtime > sharedDistMtime) {
          console.log(`[${packageName}] Shared source is newer than built types. Rebuilding shared...`);
          await buildPackage('shared');
        }
      }
    }

    // 1. Clean dist directory
    if (fs.existsSync(distDir)) {
      console.log(`[${packageName}] Cleaning dist directory: ${distDir}`);
      fs.rmSync(distDir, { recursive: true, force: true });
    }
    fs.mkdirSync(distDir, { recursive: true });

    // ✅ ENHANCED: Clean all build artifacts for this package
    const tsbuildInfoPath = join(pkgPath, 'tsconfig.tsbuildinfo');
    if (fs.existsSync(tsbuildInfoPath)) {
      console.log(`[${packageName}] Cleaning ${tsbuildInfoPath}`);
      fs.rmSync(tsbuildInfoPath, { force: true });
    }

    // 2. TypeScript Compilation with force rebuild
    console.log(`[${packageName}] Building package with fresh TypeScript compilation...`);
    execSync(`npx tsc --build ${tsconfigPath} --force --verbose`, { stdio: "inherit", cwd: pkgPath });
    console.log(`[${packageName}] TypeScript compilation step finished.`);

    const expectedDtsPath = join(distDir, 'index.d.ts');
    if (!fs.existsSync(expectedDtsPath)) {
      console.warn(`[${packageName}] WARNING: Declaration file ${expectedDtsPath} was NOT found after tsc.`);
    } else {
      console.log(`[${packageName}] Declaration file ${expectedDtsPath} found.`);

      // ✅ VERIFY: Check if NetworkConfig has decimals field
      if (packageName === 'shared') {
        const dtsContent = fs.readFileSync(expectedDtsPath, 'utf-8');
        if (dtsContent.includes('interface NetworkConfig') && dtsContent.includes('decimals:')) {
          console.log(`[${packageName}] ✅ Verified: NetworkConfig includes decimals field in generated types`);
        } else {
          console.warn(`[${packageName}] ⚠️  WARNING: NetworkConfig missing decimals field in generated types!`);
        }
      }
    }

    // 3. esbuild bundling (unchanged)
    if (packageName !== 'shared') {
      const tscEntryPoint = join(distDir, 'index.js');
      if (!fs.existsSync(tscEntryPoint)) {
        console.error(`[${packageName}] TSC output entry point ${tscEntryPoint} not found. Cannot bundle.`);
        process.exit(1);
      }
      console.log(`[${packageName}] Bundling with esbuild from ${tscEntryPoint}...`);

      let externalDependencies = Object.keys(pkgJson.dependencies || {})
        .filter(dep => dep !== '@m3s/shared');

      if (pkgJson.peerDependencies) {
        externalDependencies.push(...Object.keys(pkgJson.peerDependencies));
      }
      externalDependencies = externalDependencies.filter(dep => dep !== '@m3s/shared');

      const externalArgs = externalDependencies.map(dep => `--external:${dep}`).join(' ');

      let platform = 'neutral';
      if (packageName === 'smart-contract') {
        platform = 'node';
        console.log(`[${packageName}] Using --platform=node for esbuild because it's a Node.js-specific package.`);
      }

      const esbuildBaseCmd = `npx esbuild "${tscEntryPoint}" --bundle --platform=${platform} --target=es2020 ${externalArgs} --sourcemap`;

      const esmOutfile = join(distDir, `index.esm.js`);
      execSync(`${esbuildBaseCmd} --format=esm --outfile="${esmOutfile}"`, { stdio: "inherit", cwd: rootDir });
      console.log(`[${packageName}] ESM bundle created: ${esmOutfile}`);

      const cjsOutfile = join(distDir, `index.cjs.js`);
      execSync(`${esbuildBaseCmd} --format=cjs --outfile="${cjsOutfile}"`, { stdio: "inherit", cwd: rootDir });
      console.log(`[${packageName}] CJS bundle created: ${cjsOutfile}`);
    } else {
      console.log(`[${packageName}] 'shared' package built with tsc. JS and .d.ts files are in its dist directory. No esbuild bundling for shared itself.`);
    }

    console.log(`[${packageName}] Successfully built.`);
  }

 async function buildAll() {
    console.log("Build.ts: buildAll() started.");
    
    // ✅ ENHANCED: Always clean all build artifacts first
    const packagesOrder = ['shared', 'wallet', 'crosschain', 'smart-contract'];
    
    console.log("Cleaning all build artifacts...");
    for (const pkg of packagesOrder) {
      const pkgPath = join(rootDir, `packages/${pkg}`);
      const distPath = join(pkgPath, 'dist');
      const tsbuildInfoPath = join(pkgPath, 'tsconfig.tsbuildinfo');
      
      if (fs.existsSync(distPath)) {
        console.log(`[${pkg}] Cleaning ${distPath}`);
        fs.rmSync(distPath, { recursive: true, force: true });
      }
      
      if (fs.existsSync(tsbuildInfoPath)) {
        console.log(`[${pkg}] Cleaning ${tsbuildInfoPath}`);
        fs.rmSync(tsbuildInfoPath, { force: true });
      }
    }

    console.log("Starting fresh build for all packages...");
    for (const pkg of packagesOrder) {
      await buildPackage(pkg);
    }
    console.log("\n✓ All packages built successfully with fresh types.");
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