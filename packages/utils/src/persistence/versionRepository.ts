import * as fs from 'fs';
import * as path from 'path';

interface VersionMatrix {
  [moduleName: string]: {
    [versionString: string]: {
      features: string[];
    };
  };
}

export class VersionRepository {
  private matrix: VersionMatrix;

  constructor() {
    // Move up from dist/persistence to dist/versions
    const matrixPath = path.join(__dirname, '..', 'versions', 'versionMatrix.json');
    console.info('Loading version matrix from:', matrixPath);
    
    try {
      this.matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf-8'));
    } catch (error) {
      console.error('Failed to load version matrix:', error);
      this.matrix = {}; // Fallback empty matrix
    }
  }

  /** Check if a specific module version supports a given feature */
  public supportsFeature(
    moduleName: string,
    version: string,
    feature: string
  ): boolean {
    const moduleVersions = this.matrix[moduleName] || {};
    const data = moduleVersions[version];
    if (!data) return false;
    return data.features.includes(feature);
  }

  /** Get all features supported by a module version */
  public getFeaturesForVersion(moduleName: string, version: string): string[] {
    return this.matrix[moduleName]?.[version]?.features || [];
  }

  
}