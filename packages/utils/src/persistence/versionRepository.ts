export interface VersionMatrix {
  modules: {
    [moduleName: string]: ModuleEntry;
  };
}

export interface ModuleEntry {
  versions: {
    [moduleVersion: string]: {
      adapters: {
        [adapterName: string]: AdapterCompatibility;
      };
    };
  };
}

export interface AdapterCompatibility {
  minVersion: string;
  maxVersion: string;
  supportedFeatures: {
    [featureName: string]: {
      addedInVersion?: string;
      deprecatedInVersion?: string;
    };
  };
}

const matrixData = require('../data/versionMatrix.json') as VersionMatrix;
export class VersionRepository {
  private matrix: VersionMatrix;
  private static instance: VersionRepository;

  private constructor() {
    // Use ES module import instead of require
    this.matrix = matrixData;
  }

  /**
   * Checks if a feature is supported in a single call
   * @param params Object containing check parameters
   * @returns True if the feature is supported, false otherwise
   */
  public checkFeatureSupport(params: {
    moduleName: string;
    moduleVersion: string;
    adapterName: string;
    adapterVersion: string;
    featureName: string;
  }): boolean {
    const { moduleName, moduleVersion, adapterName, adapterVersion, featureName } = params;

    return this.supportsFeature(
      moduleName,
      moduleVersion,
      adapterName,
      adapterVersion,
      featureName
    );
  }

  public static getInstance(): VersionRepository {
    if (!VersionRepository.instance) {
      VersionRepository.instance = new VersionRepository();
    }
    return VersionRepository.instance;
  }

  // No loading necessary - everything is bundled
  public loadMatrix(): void {
    // Nothing to do - matrix is already loaded at construction time
  }

  public isAdapterCompatible(
    moduleName: string,
    moduleVersion: string,
    adapterName: string,
    adapterVersion: string
  ): boolean {
    try {
      const adapterCompat = this.matrix.modules[moduleName]?.versions[moduleVersion]?.adapters[adapterName];
      if (!adapterCompat) return false;

      const { minVersion, maxVersion } = adapterCompat;
      return this.isVersionInRange(adapterVersion, minVersion, maxVersion);
    } catch (error) {
      return false;
    }
  }

  public supportsFeature(
    moduleName: string,
    moduleVersion: string,
    adapterName: string,
    adapterVersion: string,
    featureName: string
  ): boolean {
    try {
      const adapterCompat = this.matrix.modules[moduleName]?.versions[moduleVersion]?.adapters[adapterName];
      if (!adapterCompat) return false;

      const feature = adapterCompat.supportedFeatures[featureName];
      if (!feature) return false;

      const isAdded = !feature.addedInVersion || this.compareVersions(adapterVersion, feature.addedInVersion) >= 0;
      const isNotDeprecated = !feature.deprecatedInVersion || this.compareVersions(adapterVersion, feature.deprecatedInVersion) < 0;

      return isAdded && isNotDeprecated;
    } catch (error) {
      return false;
    }
  }

  private isVersionInRange(version: string, min: string, max: string): boolean {
    if (max === '*') return this.compareVersions(version, min) >= 0;
    return this.compareVersions(version, min) >= 0 && this.compareVersions(version, max) <= 0;
  }

  private compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;
      if (partA !== partB) return partA - partB;
    }
    return 0;
  }
}