import * as fs from "fs";
import * as path from "path";

// TODO: Mejorar el interfaz añadiendo otro anidado para los adapters y sus versiones.
export interface VersionMatrix {
  [moduleName: string]: {
    [versionString: string]: {
      features: string[];
    };
  };
}

export class VersionRepository {
  private matrix: VersionMatrix;

  constructor() {
    if (typeof window !== "undefined") {
      // In a browser environment, bypass fs.
      console.info("Browser environment detected - using static fallback for version matrix.");
      // You may load a static versionMatrix (if you have one saved as JSON in your bundle) or simply fallback to {}
      this.matrix = {}; 
    } else {
      // Node: use fs to load versionMatrix.json
      const matrixPath = path.join(__dirname, "assets", "versions", "versionMatrix.json");
      console.info("Loading version matrix from:", matrixPath);
      try {
        this.matrix = JSON.parse(fs.readFileSync(matrixPath, "utf-8"));
      } catch (error) {
        console.error("Failed to load version matrix:", error);
        this.matrix = {};
      }
    }
  }

  /** Check if a specific module version supports a given feature */
  public supportsFeature(moduleName: string, version: string, feature: string): boolean {
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