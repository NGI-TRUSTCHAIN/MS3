import { ethers } from "ethers";
import { AdapterError, WalletErrorCode } from "@m3s/common";
import { EIP712TypedData } from "../types/index.js";

/**
 * Utility class for EIP-712 validation and compliance checks
 * Provides centralized validation logic for typed data signing
 */
export class EIP712Validator {
    /**
     * Validates the basic structure of EIP-712 typed data
     * @param data The typed data to validate
     * @throws AdapterError if structure is invalid
     */
    static validateStructure(data: EIP712TypedData): void {
        if (!data || typeof data !== 'object') {
            throw new AdapterError("Invalid EIP-712 structure: data must be an object", {
                code: WalletErrorCode.InvalidInput,
                methodName: 'signTypedData'
            });
        }

        // ✅ CRITICAL: Check for missing domain
        if (!data.domain) {
            throw new AdapterError("Invalid EIP-712 structure: must have domain object", {
                code: WalletErrorCode.InvalidInput,
                methodName: 'signTypedData'
            });
        }

        if (typeof data.domain !== 'object') {
            throw new AdapterError("Invalid EIP-712 structure: domain must be an object", {
                code: WalletErrorCode.InvalidInput,
                methodName: 'signTypedData'
            });
        }

        // ✅ CRITICAL: Check for missing types
        if (!data.types) {
            throw new AdapterError("Invalid EIP-712 structure: must have types object", {
                code: WalletErrorCode.InvalidInput,
                methodName: 'signTypedData'
            });
        }

        if (typeof data.types !== 'object') {
            throw new AdapterError("Invalid EIP-712 structure: types must be an object", {
                code: WalletErrorCode.InvalidInput,
                methodName: 'signTypedData'
            });
        }

        // ✅ CRITICAL: Check for missing value
        if (data.value === undefined || data.value === null) {
            throw new AdapterError("Invalid EIP-712 structure: must have value", {
                code: WalletErrorCode.InvalidInput,
                methodName: 'signTypedData'
            });
        }
    }

    /**
     * Validates the EIP-712 domain against the current network
     * @param domain The domain object from typed data
     * @param currentChainId The current network's chain ID
     * @throws AdapterError if domain is invalid or doesn't match network
     */
    static validateDomain(domain: any, currentChainId: string): void {
        // ✅ CRITICAL: Check for missing chainId in domain
        if (!domain.chainId && domain.chainId !== 0) {
            throw new AdapterError("EIP-712 domain missing chainId", {
                code: WalletErrorCode.InvalidInput,
                methodName: 'signTypedData'
            });
        }

        // Convert both to strings for comparison
        const domainChainId = domain.chainId.toString();
        const networkChainId = currentChainId.toString();

        // Support both hex and decimal comparison
        const domainChainIdHex = domainChainId.startsWith('0x')
            ? domainChainId
            : `0x${parseInt(domainChainId, 10).toString(16)}`;
        const networkChainIdHex = networkChainId.startsWith('0x')
            ? networkChainId
            : `0x${parseInt(networkChainId, 10).toString(16)}`;

        if (domainChainIdHex.toLowerCase() !== networkChainIdHex.toLowerCase()) {
            throw new AdapterError(
                `EIP-712 domain chainId (${domainChainId}) doesn't match current network (${currentChainId})`,
                {
                    code: WalletErrorCode.InvalidInput,
                    methodName: 'signTypedData'
                }
            );
        }

        if (domain.verifyingContract && !ethers.isAddress(domain.verifyingContract)) {
            throw new AdapterError("EIP-712 domain verifyingContract must be a valid address", {
                code: WalletErrorCode.InvalidInput,
                methodName: 'signTypedData'
            });
        }
    }

    /**
     * Validates the types structure of EIP-712 typed data
     * @param types The types object from typed data
     * @throws AdapterError if types structure is invalid
     */
    static validateTypes(types: Record<string, Array<{ name: string, type: string }>>): void {
        for (const [typeName, fields] of Object.entries(types)) {
            // ✅ CRITICAL: Use Array.isArray() instead of .map check
            if (!Array.isArray(fields)) {
                throw new AdapterError(`EIP-712 type '${typeName}' must be an array of field definitions`, {
                    code: WalletErrorCode.InvalidInput,
                    methodName: 'signTypedData'
                });
            }

            for (const field of fields) {
                if (!field.name || !field.type) {
                    throw new AdapterError(`EIP-712 field in '${typeName}' missing name or type`, {
                        code: WalletErrorCode.InvalidInput,
                        methodName: 'signTypedData'
                    });
                }

                // Optional: Validate field types against EIP-712 spec
                if (!EIP712Validator.isValidEIP712Type(field.type)) {
                    console.warn(`[EIP712Validator] Warning: EIP-712 field type '${field.type}' may not be standard`);
                }
            }
        }
    }

    /**
     * Validates if a type string conforms to EIP-712 standards
     * @param type The type string to validate
     * @returns true if the type is valid, false otherwise
     */
    static isValidEIP712Type(type: string): boolean {
        // Basic EIP-712 type validation
        const basicTypes = ['bool', 'address', 'string', 'bytes'];
        const dynamicTypes = /^(bytes\d+|uint\d+|int\d+)$/;
        const arrayTypes = /^(.+)\[\d*\]$/;

        // Check basic types
        if (basicTypes.includes(type)) {
            return true;
        }

        // Check dynamic types (bytes32, uint256, etc.)
        if (dynamicTypes.test(type)) {
            return true;
        }

        // Check array types (string[], uint256[], address[5], etc.)
        if (arrayTypes.test(type)) {
            const match = type.match(arrayTypes);
            if (match && match[1]) {
                const baseType = match[1];
                // Recursively validate the base type (but prevent infinite recursion)
                if (!baseType.includes('[')) {
                    return EIP712Validator.isValidEIP712Type(baseType);
                }
            }
        }

        // Dynamic bytes is valid
        if (type === 'bytes') {
            return true;
        }

        return false;
    }

    /**
     * Performs comprehensive EIP-712 validation
     * @param data The typed data to validate
     * @param currentChainId The current network's chain ID
     * @throws AdapterError if any validation fails
     */
    static validateAll(data: EIP712TypedData, currentChainId: string): void {
        EIP712Validator.validateStructure(data);
        EIP712Validator.validateDomain(data.domain, currentChainId);
        EIP712Validator.validateTypes(data.types);
    }

    /**
     * Verifies a signature immediately after signing for additional security
     * @param data The typed data that was signed
     * @param signature The signature to verify
     * @param expectedAddress The expected signer address
     * @returns true if signature is valid, false otherwise
     */
    static verifySignature(data: EIP712TypedData, signature: string, expectedAddress: string): boolean {
        try {
            const recoveredAddress = ethers.verifyTypedData(data.domain, data.types, data.value, signature);
            return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
        } catch (error) {
            console.error("[EIP712Validator] Signature verification failed:", error);
            return false;
        }
    }

    /**
     * Validates signature format for EIP-712
     * @param signature The signature to validate
     * @returns true if format is valid, false otherwise
     */
    static isValidSignatureFormat(signature: string): boolean {
        return signature.startsWith('0x') && signature.length === 132;
    }
}