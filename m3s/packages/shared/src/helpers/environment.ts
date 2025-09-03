import { AdapterError } from "../errors/AdapterError.js";
import { WalletErrorCode } from "../types/error.js";
import { RuntimeEnvironment, EnvironmentRequirements } from "../types/registry.js";

/**
 * Detect current runtime environment
 */
export function detectRuntimeEnvironment(): RuntimeEnvironment[] {

  const result = []

  // Check for Node.js
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    result.push( RuntimeEnvironment.SERVER);
  }

  // Check for browser
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    result.push( RuntimeEnvironment.BROWSER);
  }

  return result
}

/**
 * Validate adapter can run in current environment
 */
export function validateEnvironment(
  adapterName: string,
  requirements: EnvironmentRequirements
): void {
   const currentEnvs = detectRuntimeEnvironment(); // ✅ Now returns array

  // ✅ FIXED: Check if ANY current environment is supported
  const isSupported = currentEnvs.some(env => 
    requirements.supportedEnvironments.includes(env)
  );

  if (!isSupported) {
    const supportedList = requirements.supportedEnvironments.join(', ');
    const detectedList = currentEnvs.join(', ');

    let errorMessage = `Adapter '${adapterName}' requires ${supportedList} environment but detected ${detectedList}.`;
    
    if (requirements.limitations) {
      errorMessage += '\n' + requirements.limitations.join('\n');
    }

    throw new AdapterError(errorMessage, {
      code: WalletErrorCode.environment,
      methodName: 'validateEnvironment',
      details: {
        adapterName,
        currentEnvironment: currentEnvs, // ✅ Now array
        supportedEnvironments: requirements.supportedEnvironments,
        limitations: requirements.limitations
      }
    });
  }

  // Log security warnings
  if (requirements.securityNotes && requirements.securityNotes.length > 0) {
    requirements.securityNotes.forEach((note: any) => {
      console.warn(`[${adapterName}] Security Note: ${note}`);
    });
  }
}

