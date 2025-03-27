import fs from 'fs';
import path from 'path';

/**
 * Bundles internal dependencies into a package before publishing
 * @param packageName The name of the package to prepare
 */
export async function bundleDependencies(packageName: string) {
  console.log(`Bundling internal dependencies for ${packageName}...`);
  
  // Path to the registry source
  const registrySourcePath = path.resolve(process.cwd(), 'packages/registry/src/index.ts');
  
  // Path to copy the registry code to
  const destDir = path.resolve(process.cwd(), `packages/${packageName}/src/internal`);
  const destPath = path.resolve(destDir, 'registry.ts');
  
  // Create the internal directory if it doesn't exist
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  // Read the registry source code
  let registryCode = fs.readFileSync(registrySourcePath, 'utf8');
  
  // Modify export statement to avoid conflicts
  registryCode = registryCode.replace(
    'export const registry',
    '// This is a bundled version of the registry\nexport const registry'
  );
  
  // Write the modified registry code to the destination
  fs.writeFileSync(destPath, registryCode);
  console.log(`Registry code bundled to ${destPath}`);
  
  // Update package.json to create an alias for m3s-registry
  const packageJsonPath = path.resolve(process.cwd(), `packages/${packageName}/package.json`);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Add exports field to map 'm3s-registry' to internal implementation
  if (!packageJson.exports) {
    packageJson.exports = {};
  }
  
  packageJson.exports['m3s-registry'] = {
    import: './dist/internal/registry.js',
    require: './dist/internal/registry.js'
  };
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log(`Updated package.json exports to map 'm3s-registry'`);
  
  // Now update imports
  updateImports(packageName);
  
  console.log('Bundling complete!');
}

/**
 * Updates imports in source files to use the bundled registry
 */
function updateImports(packageName: string) {
  const sourceDir = path.resolve(process.cwd(), `packages/${packageName}/src`);
  
  // Walk through all source files
  const processDirectory = (dir: string) => {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && file !== 'internal') {
        // Recursively process subdirectories
        processDirectory(filePath);
      } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.js'))) {
        // Update imports in TypeScript/JavaScript files
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Replace imports from @m3s/registry with the local version
        if (content.includes("from '@m3s/registry'") || content.includes('from "@m3s/registry"')) {
          content = content.replace(
            /import\s+\{\s*registry\s*\}\s+from\s+['"]@m3s\/registry['"]/g,
            "import { registry } from '../internal/registry.js'"
          );
          
          // Handle relative path adjustment
          const relativeDepth = path.relative(sourceDir, path.dirname(filePath))
            .split(path.sep).filter(Boolean).length;
          
          if (relativeDepth > 0) {
            const prefix = Array(relativeDepth).fill('..').join('/');
            content = content.replace(
              "../internal/registry.js",
              `${prefix}/internal/registry.js`
            );
          }
          
          fs.writeFileSync(filePath, content);
          console.log(`Updated imports in ${filePath}`);
        }
      }
    }
  };
  
  processDirectory(sourceDir);
}

// You can call this function directly if needed
if (process.argv[2]) {
  bundleDependencies(process.argv[2]);
}