import { WalletErrorCode } from "../types/error.js";

export interface AdapterErrorOptions {
    code?: string;
    cause?: unknown;
    methodName?: string;
    details?: Record<string, any>; // Add this line
}

/**
 * Base error class for wallet adapter related issues.
 * Provides standardized error reporting, including optional codes and the original error cause.
 *
 * @property {WalletErrorCode | string} [code] - A specific error code (e.g., WalletErrorCode.UserRejected).
 * @property {Error} [cause] - The original error object that triggered this AdapterError. Standard `Error` property.
 * @property {string} [methodName] - The name of the adapter method where the error originated, if identifiable.
 * @property {string} [cause] - The cause of the error.
 * @property {Record<string, any>} [details] - The details if any.
*/
export class AdapterError extends Error {
    public readonly code?: WalletErrorCode | string;
    public readonly cause?: unknown;
    public readonly methodName?: string;
    public readonly details?: Record<string, any>; // Add this line

    constructor(message: string, options?: AdapterErrorOptions) {
        super(message);
        this.name = this.constructor.name;
        this.code = options?.code;
        this.cause = options?.cause;
        this.methodName = options?.methodName;
        this.details = options?.details; // Add this line

         // Log the error automatically
        console.error(
            `[AdapterError] ${message}`,
            {
                code: this.code,
                methodName: this.methodName,
                details: this.details,
                cause: this.cause,
                stack: this.stack
            }
        );
        
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
