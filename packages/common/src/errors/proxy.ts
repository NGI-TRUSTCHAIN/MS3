import { AdapterError } from "./AdapterError.js";
import { WalletErrorCode } // Assuming WalletErrorCode is a general type for error codes, adjust if needed
  // Or import a more generic ErrorCode type if you have one for all modules
  from "../types/error.js"; // Or the correct path to your error code definitions

/**
 * Creates a Proxy around an adapter instance to standardize error handling.
 * It intercepts method calls, executes them, and wraps any thrown errors
 * within a standardized `AdapterError`, preserving the original error as `cause`
 * and capturing the method name. It can also map specific underlying errors
 * to predefined error codes.
 *
 * @template T - The type of the adapter object (must be an object).
 * @param {T} adapterInstance - The original adapter instance.
 * @param {Record<string, WalletErrorCode | string>} [errorMap={}] - A map where keys are parts of original error messages
 *                                                                  and values are specific error codes to assign.
 * @param {WalletErrorCode | string} [defaultErrorCode] - A default error code to use if no specific mapping is found.
 * @param {string} [contextName='UnknownAdapter'] - A name for the adapter context, used in error messages.
 * @returns {T} - A proxied version of the adapter instance with enhanced error handling.
 */
export function createErrorHandlingProxy<T extends object>(
  adapterInstance: T,
  errorMap: Record<string, WalletErrorCode | string> = {},
  defaultErrorCode?: WalletErrorCode | string, // Can be undefined
  contextName: string = 'UnknownAdapter' // Renamed from adapterType for clarity
): T {
  return new Proxy(adapterInstance, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver);
      const methodName = String(prop);

      if (typeof originalValue === 'function') {

        const isAsync = originalValue.constructor.name === 'AsyncFunction';

        const handleError = (error: unknown) => {
          const originalErrorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[${contextName} Error] Method '${methodName}' failed: ${originalErrorMessage}`, error);

          if (error instanceof AdapterError) {
            throw error;
          }

          let mappedErrorCode: WalletErrorCode | string | undefined = defaultErrorCode;
          for (const key in errorMap) {
            if (originalErrorMessage.includes(key)) {
              mappedErrorCode = errorMap[key];
              break;
            }
          }

          throw new AdapterError(
            `${contextName} method '${methodName}' failed: ${originalErrorMessage}`,
            {
              cause: error,
              methodName: methodName,
              code: mappedErrorCode as string | undefined
            }
          );
        };

        if (isAsync) {
          // Return an async wrapper for async functions
          return async function (...args: any[]) {
            try {
              return await originalValue.apply(target, args);
            } catch (error: unknown) {
              handleError(error);
            }
          };
        } else {
          // Return a synchronous wrapper for sync functions
          return function (...args: any[]) {
            try {
              return originalValue.apply(target, args);
            } catch (error: unknown) {
              handleError(error);
            }
          };
        }
      }
      return originalValue;
    }
  });
}