import { AdapterError } from "./AdapterError.js";
// Import specific error codes if you intend to map common errors later
// import { WalletErrorCode, CrossChainErrorCode, SmartContractErrorCode } from "../types/error.js";

/**
 * Creates a Proxy around an adapter instance to standardize error handling.
 * It intercepts method calls, executes them, and wraps any thrown errors
 * within a standardized `AdapterError`, preserving the original error as `cause`
 * and capturing the method name.
 *
 * This version wraps all functions in an async wrapper for consistent await/catch behavior.
 *
 * @template T - The type of the adapter object (must be an object).
 * @param {T} adapterInstance - The original adapter instance.
 * @param {string} [adapterType='Unknown'] - A string identifying the adapter type (e.g., 'wallet', 'crosschain') for logging.
 * @returns {T} - A proxied version of the adapter instance with enhanced error handling.
 */
export function createErrorHandlingProxy<T extends object>(adapterInstance: T, adapterType: string = 'Unknown'): T {
  return new Proxy(adapterInstance, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver);
      const methodName = String(prop); // Get the name of the property being accessed

      // Only wrap properties that are functions (methods)
      if (typeof originalValue === 'function') {
        // Return an async function wrapper for consistent await/catch behavior
        return async function (...args: any[]) {
          try {
            // Await the result. Works correctly for both sync and async original methods.
            return await originalValue.apply(target, args);
          } catch (error: unknown) {
            // Log the error for debugging purposes
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[${adapterType} Adapter Error] Method '${methodName}' failed: ${errorMessage}`);

            // Check if the caught error is already an AdapterError. If so, re-throw it directly.
            if (error instanceof AdapterError) {
              throw error;
            } else {
              // Wrap the original error in a new AdapterError for standardization.
              // Pass the original error as 'cause' and include the method name.
              // Initially, we won't assign a specific code here, relying on message/cause.
              // TODO: Implement mapping of common underlying errors (e.g., network errors, user rejection)
              // to specific M3SAdapterErrorCodes within this proxy or in adapter-specific logic.
              throw new AdapterError(
                `${adapterType} adapter method '${methodName}' failed: ${errorMessage}`,
                {
                  cause: error, // Link the original error
                  methodName: methodName, // Include the method where it happened
                  // code: DetermineErrorCode(error) // Placeholder for future mapping logic
                }
              );
            }
          }
        };
      }

      // If the accessed property is not a function, return it directly
      return originalValue;
    }
  });
}