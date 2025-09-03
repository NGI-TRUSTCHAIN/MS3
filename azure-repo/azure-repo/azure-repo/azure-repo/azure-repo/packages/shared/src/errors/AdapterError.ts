import { WalletErrorCode } from "../types/error.js";

export interface AdapterErrorOptions {
    code?: string;
    cause?: unknown;
    methodName?: string;
    details?: Record<string, any>;
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
    public readonly details?: Record<string, any>;

    constructor(message: string, options?: AdapterErrorOptions) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = this.constructor.name;
        this.code = options?.code;
        this.cause = options?.cause;
        this.methodName = options?.methodName;
        this.details = options?.details;
        console.error(
            `[AdapterError] ${this.name}: ${message}`,
            { code: this.code, methodName: this.methodName, details: this.details, cause: this.safeSerializeCause(this.cause) }
        );

        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            methodName: this.methodName,
            details: this.details,
            cause: this.safeSerializeCause(this.cause),
            stack: this.stack
        };
    }

    toString() {
        const base = `${this.name}: ${this.message}` + (this.code ? ` (code=${this.code})` : '') + (this.methodName ? ` [${this.methodName}]` : '');
        if (this.details) return `${base} details=${JSON.stringify(this.details)}`;
        if (this.cause) return `${base} cause=${this.safeSerializeCause(this.cause)}`;
        return base;
    }

    safeSerializeCause(cause: any) {
        try {
            if (!cause) return cause;
            if (cause instanceof Error) {
                const c: any = { name: cause.name, message: cause.message, stack: cause.stack };
                if ((cause as any).data) c.data = (cause as any).data;
                if ((cause as any).info) c.info = (cause as any).info;
                return c;
            }
            return typeof cause === 'object' ? cause : String(cause);
        } catch {
            return String(cause);
        }
    }
}
