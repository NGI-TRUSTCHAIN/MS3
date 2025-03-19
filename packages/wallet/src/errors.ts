export class AdapterError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AdapterError';
    }
  }
  
  // Define which methods should be treated as async
  const asyncMethods = [
    'initialize', 'requestAccounts', 'getAccounts', 'getNetwork',
    'switchNetwork', 'sendTransaction', 'signTransaction', 'signMessage',
    'signTypedData', 'getGasPrice', 'estimateGas'
  ];
  
  export function createErrorHandlingProxy(target: any): any {
    return new Proxy(target, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        
        if (typeof value === 'function') {
          const methodName = String(prop);
          
          // Check if this is an async method
          if (asyncMethods.includes(methodName)) {
            // Async wrapper
            return async function(...args: any[]) {
              try {
                return await value.apply(target, args);
              } catch (error: any) {
                console.error(`Error in adapter method ${methodName}: ${error.message || error}`);
                throw new AdapterError(`AdapterError in ${methodName}: ${error.message || error}`);
              }
            };
          } else {
            // Synchronous wrapper
            return function(...args: any[]) {
              try {
                return value.apply(target, args);
              } catch (error: any) {
                console.error(`Error in adapter method ${methodName}: ${error.message || error}`);
                throw new AdapterError(`AdapterError in ${methodName}: ${error.message || error}`);
              }
            };
          }
        }
        
        return value;
      }
    });
  }