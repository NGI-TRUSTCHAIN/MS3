import { AdapterError } from "../errors/AdapterError.js";
import { WalletErrorCode } from "../types/error.js";
import { RuntimeEnvironment, EnvironmentRequirements } from "../types/registry.js";

/**
 * Detect current runtime environment
 */
export function detectRuntimeEnvironment(): RuntimeEnvironment[] {

  const result = []

  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    result.push( RuntimeEnvironment.SERVER);
  }

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
   const currentEnvs = detectRuntimeEnvironment();

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
        currentEnvironment: currentEnvs,
        supportedEnvironments: requirements.supportedEnvironments,
        limitations: requirements.limitations
      }
    });
  }

  if (requirements.securityNotes && requirements.securityNotes.length > 0) {
    requirements.securityNotes.forEach((note: any) => {
      console.warn(`[${adapterName}] Security Note: ${note}`);
    });
  }
}

