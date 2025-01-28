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
    const matrixPath = path.join(__dirname, 'versionMatrix.json');
    console.info('Loading version matrix from:', matrixPath);
    this.matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf-8'));
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