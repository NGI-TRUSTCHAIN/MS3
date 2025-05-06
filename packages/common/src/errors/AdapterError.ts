import { WalletErrorCode } from "../types/error.js";

/**
 * Base error class for wallet adapter related issues.
 * Provides standardized error reporting, including optional codes and the original error cause.
 *
 * @property {WalletErrorCode | string} [code] - A specific error code (e.g., WalletErrorCode.UserRejected).
 * @property {Error} [cause] - The original error object that triggered this AdapterError. Standard `Error` property.
 * @property {string} [methodName] - The name of the adapter method where the error originated, if identifiable.
 */
export class AdapterError extends Error {
    public readonly code?: WalletErrorCode | string;
    public readonly methodName?: string;
    // 'cause' is implicitly defined by the super constructor in modern JS/TS

    /**
     * Creates an instance of AdapterError.
     * @param message - The primary error message.
     * @param options - Optional details including code, cause (original error), and method name.
     */
    constructor(
        message: string,
        options?: {
            /** A specific error code (e.g., WalletErrorCode.UserRejected). */
            code?: WalletErrorCode | string;
            /** The original error object that caused this issue. */
            cause?: Error | unknown; // Allow unknown for broader catch compatibility
            /** The name of the adapter method where the error occurred (e.g., 'sendTransaction'). */
            methodName?: string;
        }
    ) {
        // Pass 'cause' to the base Error constructor for standard error chaining
        super(message, { cause: options?.cause });
        this.name = 'AdapterError'; // Standard practice for custom errors
        this.code = options?.code;
        this.methodName = options?.methodName;

        // Ensure the stack trace originates from the AdapterError constructor
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AdapterError);
        }
    }
}
