import { AdapterError } from "./AdapterError.js";
import { WalletErrorCode } from "../types/error.js";
import { Capability, MethodToCapabilityMap } from "../registry/capability.js";

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
  capabilities: Capability[],
  errorMap: Record<string, WalletErrorCode | string> = {},
  defaultErrorCode?: WalletErrorCode | string,
  contextName: string = 'UnknownAdapter'
): T {
  return new Proxy(adapterInstance, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver);
      const methodName = String(prop);

      if (typeof originalValue === 'function') {

        const requiredCapability = MethodToCapabilityMap[methodName];
        if (requiredCapability && !capabilities.includes(requiredCapability)) {
          return () => {
            throw new AdapterError(
              `Method '${methodName}' is not supported by ${contextName}. It lacks the required capability: '${requiredCapability}'.`,
              { code: 'METHOD_NOT_SUPPORTED', methodName }
            );
          };
        }

        const isAsync = originalValue.constructor.name === 'AsyncFunction';

        const extractRpcMeta = (err: any) => {
          if (!err || typeof err !== 'object') return undefined;
          const meta: Record<string, any> = {};
          if (err.data) meta.revert = err.data;
          if (err.error?.data) meta.revert = meta.revert ?? err.error.data;
          if (err.info?.error?.data) meta.revert = meta.revert ?? err.info.error.data;
          if (err.info?.payload) meta.rpcPayload = err.info.payload;
          if (err.payload) meta.rpcPayload = meta.rpcPayload ?? err.payload;
          if (err.transaction) meta.transaction = err.transaction;
          if (err.response?.body) meta.responseBody = err.response.body;
          if (err.error?.body) meta.errorBody = err.error.body;
          if (err.reason) meta.reason = err.reason;
          if (err instanceof AdapterError) {
            if ((err as any).details) meta.innerDetails = (err as any).details;
            if ((err as any).cause) meta.innerCause = (err as any).cause;
          }
          return Object.keys(meta).length ? meta : undefined;
        };

        const handleError = (error: unknown) => {
          const originalErrorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[${contextName} Error] Method '${methodName}' failed: ${originalErrorMessage}`, error);

          const anyErr: any = error as any;
          const revertData = anyErr?.data || anyErr?.error?.data || anyErr?.info?.error?.data || anyErr?.error?.body;
          if (revertData) {
            console.error(`[${contextName} Error] Revert payload / RPC data:`, revertData);

          }
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

         const rpcMeta = extractRpcMeta(error as any);
          const shortSuffix = rpcMeta?.revert ? ` (revert=${rpcMeta.revert})` : '';
          const composedMessage = `${contextName} method '${methodName}' failed: ${originalErrorMessage}${shortSuffix}`;

          throw new AdapterError(composedMessage, {
            cause: error,
            methodName,
            code: mappedErrorCode as string | undefined,
            details: rpcMeta
          });
        };
        
        if (isAsync) {
          return async function (...args: any[]) {
            try {
              return await originalValue.apply(target, args);
            } catch (error: unknown) {
              handleError(error);
            }
          };
        } else {
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