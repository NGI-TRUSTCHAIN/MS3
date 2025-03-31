export class AdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdapterError';
  }
}

const asyncMethods = ['initialize', 'generateContract', 'compile', 'deploy', 'callMethod'];

export function createErrorHandlingProxy<T extends object>(target: T): T {
  return new Proxy(target, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        const methodName = String(prop);
        if (asyncMethods.includes(methodName)) {
          return async function (...args: any[]) {
            try {
              return await value.apply(target, args);
            } catch (error: any) {
              console.error(`Error in adapter method ${methodName}: ${error.message || error}`);
              throw new AdapterError(`AdapterError in ${methodName}: ${error.message || error}`);
            }
          };
        } else {
          return function (...args: any[]) {
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