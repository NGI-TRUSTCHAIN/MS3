
class AdapterError extends Error {
    constructor(method: string, originalError: any) {
        super(`AdapterError in ${method}: ${originalError.message || originalError}`);
        this.name = "AdapterError";
    }
}

export function createErrorHandlingProxy<T extends object>(adapter: T): T {
    return new Proxy(adapter, {
        get(target, prop, receiver) {
            const orig = Reflect.get(target, prop, receiver);
            if (typeof orig === 'function') {
                return async (...args: any[]) => {
                    try {
                        return await orig.apply(target, args);
                    } catch (error: any) {
                        console.error(`Error in adapter method ${String(prop)}:`, error);
                        // Optionally adapt error message or replace the error type here.
                        throw new AdapterError(String(prop), error); 
                    }
                };
            }
            return orig;
        },
    });
}