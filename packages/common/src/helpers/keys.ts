import { Wallet as EthersWallet, HDNodeWallet, Mnemonic, Wallet, isHexString } from 'ethers'; // Using ethers v6 style imports

/**
 * Defines the contract for private key utility operations.
 * Implementations can be specific to different blockchain ecosystems.
 */
export interface IPrivateKeyHelper {
    /**
     * Generates a new private key.
     * @returns A string representing the private key.
     * @throws Error if key generation fails.
     */
    generatePrivateKey(): string;

    /**
     * Encrypts a private key using a password.
     * For EVM, this typically produces a JSON keystore (EIP-2335).
     * @param privateKey The private key string to encrypt.
     * @param password The password to use for encryption.
     * @returns A promise that resolves to the encrypted key string.
     * @throws Error if encryption fails or private key is invalid.
     */
    encryptPrivateKey(privateKey: string, password: string): Promise<string>;

    /**
     * Decrypts an encrypted private key string using a password.
     * @param encryptedKey The encrypted key string (e.g., JSON keystore for EVM).
     * @param password The password to use for decryption.
     * @returns A promise that resolves to the decrypted private key string.
     * @throws Error if decryption fails (e.g., invalid format, incorrect password).
     */
    decryptPrivateKey(encryptedKey: string, password: string): Promise<string>;

    /**
     * Derives the public address associated with a given private key.
     * @param privateKey The private key string.
     * @returns The public address string.
     * @throws Error if the private key is invalid or address derivation fails.
     */
    getAddressFromPrivateKey(privateKey: string): string;

    /**
     * Generates a new BIP-39 mnemonic phrase.
     * @param wordlist - Optional wordlist to use (e.g., ethers.wordlists.en).
     * @returns A string representing the mnemonic phrase.
     */
    generateMnemonic(wordlist?: any): string; // ethers.Wordlist type might be specific

    /**
     * Derives a private key from a mnemonic phrase and an optional derivation path.
     * @param mnemonic The mnemonic phrase.
     * @param path The HD path (e.g., "m/44'/60'/0'/0/0" for EVM default). Defaults to EVM standard.
     * @returns The derived private key string.
     * @throws Error if derivation fails.
     */
    getPrivateKeyFromMnemonic(mnemonic: string, path?: string): string;
}


/**
 * EVM-specific implementation of IPrivateKeyHelper using ethers.js.
 * This helper provides utilities for generating, encrypting, decrypting,
 * and deriving addresses from EVM-compatible private keys.
 */
export class PrivateKeyHelper implements IPrivateKeyHelper {

    /**
     * Generates a new random EVM-compatible private key.
     * @returns A string representing the private key (hexadecimal, 0x-prefixed).
     */
    public generatePrivateKey(): string {
        try {
            const wallet = EthersWallet.createRandom();
            return wallet.privateKey;
        } catch (error: any) {
            throw new Error(`[PrivateKeyHelper.generatePrivateKey] Failed: ${error.message}`);
        }
    }

    /**
     * Encrypts an EVM private key into a JSON keystore (EIP-2335 format) using a password.
     * @param privateKey The EVM private key string (hexadecimal, 0x-prefixed).
     * @param password The password for encryption.
     * @returns A promise resolving to the JSON keystore string.
     * @throws Error if the private key is invalid or encryption fails.
     */
    public async encryptPrivateKey(privateKey: string, password: string): Promise<string> {
        if (!this.isValidEvmPrivateKey(privateKey)) {
            throw new Error("[PrivateKeyHelper.encryptPrivateKey] Invalid private key format.");
        }
        try {
            const wallet = new EthersWallet(privateKey);
            // The progress callback is optional, not passing it for simplicity here
            const jsonKeystore = await wallet.encrypt(password);
            return jsonKeystore;
        } catch (error: any) {
            throw new Error(`[PrivateKeyHelper.encryptPrivateKey] Encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypts an EVM JSON keystore using a password.
     * @param encryptedJsonKeystore The JSON keystore string.
     * @param password The password for decryption.
     * @returns A promise resolving to the decrypted EVM private key string.
     * @throws Error if decryption fails (e.g., invalid keystore, incorrect password).
     */
    public async decryptPrivateKey(encryptedJsonKeystore: string, password: string): Promise<string> {
        try {
            // The progress callback is optional
            const wallet = await EthersWallet.fromEncryptedJson(encryptedJsonKeystore, password);
            return wallet.privateKey;
        } catch (error: any) {
            throw new Error(`[PrivateKeyHelper.decryptPrivateKey] Decryption failed: ${error.message}`);
        }
    }

    /**
     * Derives the public Ethereum address from an EVM private key.
     * @param privateKey The EVM private key string (hexadecimal, 0x-prefixed).
     * @returns The corresponding public address string.
     * @throws Error if the private key is invalid.
     */
    public getAddressFromPrivateKey(privateKey: string): string {
        if (!this.isValidEvmPrivateKey(privateKey)) {
            throw new Error("[PrivateKeyHelper.getAddressFromPrivateKey] Invalid private key format.");
        }
        try {
            const wallet = new EthersWallet(privateKey);
            return wallet.address;
        } catch (error: any) {
            throw new Error(`[PrivateKeyHelper.getAddressFromPrivateKey] Failed to derive address: ${error.message}`);
        }
    }

    /**
    * Generates a new random BIP39 mnemonic phrase.
    * Uses ethers.Wallet.createRandom() for robust generation.
    * @returns A randomly generated mnemonic phrase (typically 12 words).
    * @throws Error if mnemonic generation fails.
    */
    public generateMnemonic(): string {
        try {
            const randomWallet = Wallet.createRandom();
            if (!randomWallet.mnemonic || !randomWallet.mnemonic.phrase) {
                // This case should be rare with ethers.Wallet.createRandom()
                throw new Error("Failed to generate mnemonic phrase from random wallet.");
            }
            return randomWallet.mnemonic.phrase;
        } catch (error: any) {
            // Wrap the error with context for better debugging
            const wrappedError = new Error(`[PrivateKeyHelper.generateMnemonic] Failed during mnemonic generation: ${error.message}`);
            // It can be helpful to retain the original error's stack or cause
            if (error.stack) {
                (wrappedError as any).stack = error.stack;
            }
            (wrappedError as any).cause = error; // Preserve the original error as cause
            throw wrappedError;
        }
    }

    /**
     * Derives an EVM private key from a mnemonic phrase and an optional HD path.
     * @param mnemonic The BIP-39 mnemonic phrase.
     * @param path The HD path (e.g., "m/44'/60'/0'/0/0"). Defaults to the standard Ethereum path.
     * @returns The derived private key string.
     * @throws Error if the mnemonic is invalid or derivation fails.
     */
    public getPrivateKeyFromMnemonic(mnemonic: string, path?: string): string {
        const hdPath = path || "m/44'/60'/0'/0/0"; // Default Ethereum HD path
        try {
            if (!Mnemonic.isValidMnemonic(mnemonic)) {
                throw new Error("Invalid mnemonic phrase provided.");
            }
            const mnemonicInstance = Mnemonic.fromPhrase(mnemonic);
            // In ethers v6, HDNodeWallet.fromMnemonic is used to get the node for a specific path
            const hdNode = HDNodeWallet.fromMnemonic(mnemonicInstance, hdPath);
            return hdNode.privateKey;
        } catch (error: any) {
            throw new Error(`[PrivateKeyHelper.getPrivateKeyFromMnemonic] Failed: ${error.message}`);
        }
    }

    /**
     * Validates if the given string is a plausible EVM private key format.
     * (Basic check for 0x prefix and 64 hex characters).
     * @param privateKey The string to validate.
     * @returns True if it matches the basic format, false otherwise.
     */
    public isValidEvmPrivateKey(privateKey: string): boolean {
        return typeof privateKey === 'string' && isHexString(privateKey, 32);
    }
}