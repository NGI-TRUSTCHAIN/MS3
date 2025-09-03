import { describe, beforeEach, it, expect, beforeAll } from 'vitest';
import { createWallet, EIP712TypedData, IEVMWallet } from '@m3s/wallet';
import { EIP712Validator } from '../src/helpers/signatures.js';
import { NetworkHelper, PrivateKeyHelper } from '@m3s/shared';
import { ethers } from 'ethers';
import { TEST_PRIVATE_KEY } from '../config.js';

describe('Signature and EIP-712 Tests', () => {
    let ethersWallet: IEVMWallet;
    let accounts: string[];
    const networkHelper = NetworkHelper.getInstance();
    const pkHelper = new PrivateKeyHelper();

    beforeAll(async () => {
        await networkHelper.ensureInitialized();
    }, 15000); // ✅ Increase timeout

    beforeEach(async () => {
        const privateKey = TEST_PRIVATE_KEY || pkHelper.generatePrivateKey();

        ethersWallet = await createWallet({
            name: 'ethers',
            version: '1.0.0',
            options: { privateKey }
        });

        const networkConfig = await networkHelper.getNetworkConfig('holesky');
        if (networkConfig && networkConfig.rpcUrls && networkConfig.rpcUrls.length > 0) {
            console.log('[Test Setup 07_Signatures] Attempting to set provider with Sepolia config for ethersWallet.');
            try {
                await ethersWallet.setProvider(networkConfig);
                if (ethersWallet.isConnected()) {
                    console.log('[Test Setup 07_Signatures] ethersWallet successfully connected via setProvider.');
                    const network = await ethersWallet.getNetwork();
                    console.log(`[Test Setup 07_Signatures] Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
                } else {
                    console.warn('[Test Setup 07_Signatures] ethersWallet.setProvider called but wallet is still not connected.');
                }
            } catch (error) {
                console.error('[Test Setup 07_Signatures] Failed to set provider for signature tests:', error);
            }
        } else {
            console.warn('[Test Setup 07_Signatures] Sepolia config not available or no RPC URLs; provider not set for ethersWallet.');
        }

        try {
            accounts = await ethersWallet.getAccounts();
            if (accounts.length === 0) {
                console.error('[Test Setup 07_Signatures] No accounts retrieved from ethersWallet.');
            }
        } catch (error) {
            console.error('[Test Setup 07_Signatures] Error getting accounts:', error);
            accounts = []; // Ensure accounts is an array
        }
    }, 30000);

    describe('Basic Message Signing', () => {
        it('should sign and verify string messages', async () => {
            const message = 'Hello, this is a test message for signing!';
            const signature = await ethersWallet.signMessage(message);

            expect(signature).toBeDefined();
            expect(signature.startsWith('0x')).toBe(true);
            expect(signature.length).toBe(132); // Standard ECDSA signature length

            // Verify with correct address
            const isValid = await ethersWallet.verifySignature(message, signature, accounts[0]);
            expect(isValid).toBe(true);

            // Verify with wrong address should fail
            const randomAddress = ethers.Wallet.createRandom().address;
            const isInvalid = await ethersWallet.verifySignature(message, signature, randomAddress);
            expect(isInvalid).toBe(false);
        });

        it('should sign and verify Uint8Array messages', async () => {
            const message = 'Test message for Uint8Array signing';
            const messageBytes = ethers.toUtf8Bytes(message);

            const signature = await ethersWallet.signMessage(messageBytes);

            expect(signature).toBeDefined();
            expect(signature.startsWith('0x')).toBe(true);

            // Verify with original bytes
            const isValid = await ethersWallet.verifySignature(messageBytes, signature, accounts[0]);
            expect(isValid).toBe(true);

            // Verify with different bytes should fail
            const differentBytes = ethers.toUtf8Bytes('Different message');
            const isInvalid = await ethersWallet.verifySignature(differentBytes, signature, accounts[0]);
            expect(isInvalid).toBe(false);
        });

        it('should handle signature verification edge cases', async () => {
            const message = 'Edge case test message';
            const signature = await ethersWallet.signMessage(message);

            // Test with invalid signature format - should return false
            const invalidSignature = '0xinvalidsignature';
            const result1 = await ethersWallet.verifySignature(message, invalidSignature, accounts[0]);
            expect(result1).toBe(false);

            // Test with invalid address format - THIS should throw
            await expect(
                ethersWallet.verifySignature(message, signature, 'invalid_address')
            ).rejects.toThrow();

            // Test with empty address - THIS should throw  
            await expect(
                ethersWallet.verifySignature(message, signature, '')
            ).rejects.toThrow();
        });
    });

    describe('EIP-712 Typed Data Signing', () => {
        it('should sign and verify EIP-712 typed data', async () => {
            // Skip if not connected (chain validation won't work)
            if (!ethersWallet.isConnected()) {
                console.warn('Skipping EIP-712 test - wallet not connected to validate chain ID');
                return;
            }

            // ✅ Get chainId within test scope to avoid scope issues
            const network = await ethersWallet.getNetwork();
            const chainId = network.chainId.toString();

            const typedData: EIP712TypedData = {
                domain: {
                    name: 'Test DApp',
                    version: '1',
                    chainId: chainId,
                    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
                },
                types: {
                    Person: [
                        { name: 'name', type: 'string' },
                        { name: 'wallet', type: 'address' }
                    ],
                    Mail: [
                        { name: 'from', type: 'Person' },
                        { name: 'to', type: 'Person' },
                        { name: 'contents', type: 'string' },
                        { name: 'timestamp', type: 'uint256' }
                    ]
                },
                value: {
                    from: {
                        name: 'Alice',
                        wallet: accounts[0]
                    },
                    to: {
                        name: 'Bob',
                        wallet: ethers.Wallet.createRandom().address
                    },
                    contents: 'Hello Bob! This is a test message.',
                    timestamp: Date.now()
                }
            };

            const signature = await ethersWallet.signTypedData(typedData);

            expect(signature).toBeDefined();
            expect(signature.startsWith('0x')).toBe(true);
            expect(signature.length).toBe(132);

            // Verify signature
            const isValid = await ethersWallet.verifySignature(typedData, signature, accounts[0]);
            expect(isValid).toBe(true);

            // Verify with wrong address should fail
            const randomAddress = ethers.Wallet.createRandom().address;
            const isInvalid = await ethersWallet.verifySignature(typedData, signature, randomAddress);
            expect(isInvalid).toBe(false);
        });

        it('should validate EIP-712 structure before signing', async () => {
            // Test invalid structure - missing domain
            const invalidData1 = {
                types: {
                    Mail: [{ name: 'contents', type: 'string' }]
                },
                value: { contents: 'test' }
            } as any;

            await expect(ethersWallet.signTypedData(invalidData1))
                .rejects.toThrow(/Invalid EIP-712 structure/);

            // Test invalid structure - missing types
            const invalidData2 = {
                domain: { name: 'Test', version: '1', chainId: 1 },
                value: { contents: 'test' }
            } as any;

            await expect(ethersWallet.signTypedData(invalidData2))
                .rejects.toThrow(/Invalid EIP-712 structure/);

            // Test invalid structure - missing value
            const invalidData3 = {
                domain: { name: 'Test', version: '1', chainId: 1 },
                types: {
                    Mail: [{ name: 'contents', type: 'string' }]
                }
            } as any;

            await expect(ethersWallet.signTypedData(invalidData3))
                .rejects.toThrow(/Invalid EIP-712 structure/);
        });

        it('should validate domain fields', async () => {
            if (!ethersWallet.isConnected()) {
                console.warn('Skipping "validate domain fields" test - ethersWallet not connected.');
                return;
            }

            // ✅ Get current chainId for the test
            const network = await ethersWallet.getNetwork();
            const currentChainId = network.chainId.toString();

            // Test missing chainId (this part is fine)
            const invalidDomain1: EIP712TypedData = {
                domain: {
                    name: 'Test DApp',
                    version: '1',
                    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
                    // chainId missing
                } as any,
                types: {
                    Mail: [{ name: 'contents', type: 'string' }]
                },
                value: { contents: 'test' }
            };

            await expect(ethersWallet.signTypedData(invalidDomain1))
                .rejects.toThrow(/missing chainId/);

            // Test invalid verifying contract address
            const invalidDomain2: EIP712TypedData = {
                domain: {
                    name: 'Test DApp',
                    version: '1',
                    chainId: currentChainId, // ✅ USE CORRECT CHAIN ID HERE
                    verifyingContract: 'invalid_address' // This is what we want to test
                },
                types: {
                    Mail: [{ name: 'contents', type: 'string' }]
                },
                value: { contents: 'test' }
            };

            await expect(ethersWallet.signTypedData(invalidDomain2))
                .rejects.toThrow(/must be a valid address/); // Now this expectation should be met
        });

        it('should validate types structure', async () => {
            // Test invalid types - not an array
            const invalidTypes1: EIP712TypedData = {
                domain: { name: 'Test', version: '1', chainId: '0x4268' },
                types: {
                    Person: 'not_an_array'
                } as any,
                value: { name: 'Alice' }
            };

            await expect(ethersWallet.signTypedData(invalidTypes1))
                .rejects.toThrow(/must be an array/);

            // Test invalid field definition - missing name
            const invalidTypes2: EIP712TypedData = {
                domain: { name: 'Test', version: '1', chainId: '1' },
                types: {
                    Person: [
                        { type: 'string' } // Missing name
                    ]
                } as any,
                value: { name: 'Alice' }
            };

            await expect(ethersWallet.signTypedData(invalidTypes2))
                .rejects.toThrow(/missing name or type/);

            // Test invalid field definition - missing type
            const invalidTypes3: EIP712TypedData = {
                domain: { name: 'Test', version: '1', chainId: '1' },
                types: {
                    Person: [
                        { name: 'name' } // Missing type
                    ]
                } as any,
                value: { name: 'Alice' }
            };

            await expect(ethersWallet.signTypedData(invalidTypes3))
                .rejects.toThrow(/missing name or type/);
        });

        it('should handle chain ID validation when connected', async () => {
            if (!ethersWallet.isConnected()) {
                console.warn('Skipping chain ID validation test - wallet not connected');
                return;
            }

            // Test wrong chain ID
            const wrongChainData: EIP712TypedData = {
                domain: {
                    name: 'Test DApp',
                    version: '1',
                    chainId: '999999', // Wrong chain ID
                    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
                },
                types: {
                    Mail: [{ name: 'contents', type: 'string' }]
                },
                value: { contents: 'test' }
            };

            await expect(ethersWallet.signTypedData(wrongChainData))
                .rejects.toThrow(/doesn't match current network/);
        });

        it('should support complex nested types', async () => {
            if (!ethersWallet.isConnected()) {
                console.warn('Skipping complex types test - wallet not connected');
                return;
            }

            // ✅ Get chainId in test scope
            const network = await ethersWallet.getNetwork();
            const chainId = network.chainId.toString();

            const complexTypedData: EIP712TypedData = {
                domain: {
                    name: 'Complex Test',
                    version: '1',
                    chainId: chainId,
                    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
                },
                types: {
                    Asset: [
                        { name: 'token', type: 'address' },
                        { name: 'amount', type: 'uint256' }
                    ],
                    Order: [
                        { name: 'maker', type: 'address' },
                        { name: 'taker', type: 'address' },
                        { name: 'assets', type: 'Asset[]' },
                        { name: 'expiry', type: 'uint256' },
                        { name: 'nonce', type: 'uint256' }
                    ]
                },
                value: {
                    maker: accounts[0],
                    taker: ethers.Wallet.createRandom().address,
                    assets: [
                        {
                            token: ethers.getAddress('0xa0b86a33e6417d6e5230bbf2d6e0d21da8bfec99'), // Ensure lowercase
                            amount: '1000000000000000000'
                        },
                        {
                            token: ethers.getAddress('0xdac17f958d2ee523a2206206994597c13d831ec7'), // Ensure lowercase
                            amount: '1000000'
                        }
                    ],
                    expiry: Math.floor(Date.now() / 1000) + 3600,
                    nonce: 12345
                }
            };

            const signature = await ethersWallet.signTypedData(complexTypedData);

            expect(signature).toBeDefined();
            expect(signature.startsWith('0x')).toBe(true);

            // Verify the complex signature
            const isValid = await ethersWallet.verifySignature(complexTypedData, signature, accounts[0]);
            expect(isValid).toBe(true);
        });
    });

    describe('EIP712Validator Utility Tests', () => {
        it('should validate EIP-712 type formats', () => {
            // Valid basic types
            expect(EIP712Validator.isValidEIP712Type('string')).toBe(true);
            expect(EIP712Validator.isValidEIP712Type('address')).toBe(true);
            expect(EIP712Validator.isValidEIP712Type('bool')).toBe(true);
            expect(EIP712Validator.isValidEIP712Type('bytes')).toBe(true);

            // Valid sized types
            expect(EIP712Validator.isValidEIP712Type('uint256')).toBe(true);
            expect(EIP712Validator.isValidEIP712Type('int8')).toBe(true);
            expect(EIP712Validator.isValidEIP712Type('bytes32')).toBe(true);

            // Valid array types
            expect(EIP712Validator.isValidEIP712Type('string[]')).toBe(true);
            expect(EIP712Validator.isValidEIP712Type('uint256[]')).toBe(true);
            expect(EIP712Validator.isValidEIP712Type('address[5]')).toBe(true);

            // Invalid types
            expect(EIP712Validator.isValidEIP712Type('invalid')).toBe(false);
            expect(EIP712Validator.isValidEIP712Type('uint')).toBe(false); // Should be uint256
            expect(EIP712Validator.isValidEIP712Type('')).toBe(false);
        });

        it('should validate signature format', () => {
            const validSignature = '0x' + 'a'.repeat(130); // 132 chars total
            const invalidSignatureShort = '0x' + 'a'.repeat(64);
            const invalidSignatureLong = '0x' + 'a'.repeat(140);
            const invalidSignatureNoPrefix = 'a'.repeat(130);

            expect(EIP712Validator.isValidSignatureFormat(validSignature)).toBe(true);
            expect(EIP712Validator.isValidSignatureFormat(invalidSignatureShort)).toBe(false);
            expect(EIP712Validator.isValidSignatureFormat(invalidSignatureLong)).toBe(false);
            expect(EIP712Validator.isValidSignatureFormat(invalidSignatureNoPrefix)).toBe(false);
        });

        it('should perform structure validation independently', () => {
            const validData: EIP712TypedData = {
                domain: { name: 'Test', version: '1', chainId: 1 },
                types: { Person: [{ name: 'name', type: 'string' }] },
                value: { name: 'Alice' }
            };

            // Should not throw
            expect(() => EIP712Validator.validateStructure(validData)).not.toThrow();

            // Should throw for invalid structure
            expect(() => EIP712Validator.validateStructure({} as any)).toThrow();
            expect(() => EIP712Validator.validateStructure({ domain: {} } as any)).toThrow();
        });

        it('should verify signatures independently', () => {
            const validData: EIP712TypedData = {
                domain: { name: 'Test', version: '1', chainId: 1 },
                types: { Person: [{ name: 'name', type: 'string' }] },
                value: { name: 'Alice' }
            };

            const dummySignature = '0x' + '1'.repeat(130);
            const dummyAddress = '0x' + '2'.repeat(40);

            // Should return false for invalid signature (but not throw)
            const result = EIP712Validator.verifySignature(validData, dummySignature, dummyAddress);
            expect(result).toBe(false);
        });
    });

    describe('Performance and Security Tests', () => {
        it('should handle multiple signatures efficiently', async () => {
            const startTime = Date.now();
            const signatures: string[] = [];

            // Sign multiple messages rapidly
            for (let i = 0; i < 10; i++) {
                const message = `Performance test message ${i}`;
                const signature = await ethersWallet.signMessage(message);
                signatures.push(signature);
            }

            const signingTime = Date.now() - startTime;

            // Verify all signatures
            const verifyStartTime = Date.now();
            for (let i = 0; i < 10; i++) {
                const message = `Performance test message ${i}`;
                const isValid = await ethersWallet.verifySignature(message, signatures[i], accounts[0]);
                expect(isValid).toBe(true);
            }
            const verifyTime = Date.now() - verifyStartTime;

            console.log(`✅ Performance test: ${10} signatures in ${signingTime}ms, ${10} verifications in ${verifyTime}ms`);

            // Should complete within reasonable time
            expect(signingTime).toBeLessThan(5000); // 5 seconds for 10 signatures
            expect(verifyTime).toBeLessThan(2000);  // 2 seconds for 10 verifications
        });

        it('should prevent signature replay attacks through proper validation', async () => {
            if (!ethersWallet.isConnected()) {
                console.warn('Skipping replay attack test - wallet not connected');
                return;
            }

            // ✅ Get chainId within this test's scope
            const network = await ethersWallet.getNetwork();
            const currentChainId = network.chainId.toString();

            const originalData: EIP712TypedData = {
                domain: {
                    name: 'Anti-Replay Test',
                    version: '1',
                    chainId: currentChainId, // ✅ Use the chainId from this scope
                    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC'
                },
                types: {
                    Transaction: [
                        { name: 'to', type: 'address' },
                        { name: 'value', type: 'uint256' },
                        { name: 'nonce', type: 'uint256' },
                        { name: 'deadline', type: 'uint256' }
                    ]
                },
                value: {
                    to: ethers.Wallet.createRandom().address,
                    value: '1000000000000000000',
                    nonce: 1,
                    deadline: Math.floor(Date.now() / 1000) + 3600
                }
            };

            const originalSignature = await ethersWallet.signTypedData(originalData);

            // Try to replay with different nonce (should create different signature)
            const replayData = {
                ...originalData,
                value: {
                    ...originalData.value,
                    nonce: 2 // Different nonce
                }
            };

            const replaySignature = await ethersWallet.signTypedData(replayData);

            // Signatures should be different
            expect(originalSignature).not.toBe(replaySignature);

            // Original signature should not validate replay data
            const isReplayValid = await ethersWallet.verifySignature(
                replayData,
                originalSignature,
                accounts[0]
            );
            expect(isReplayValid).toBe(false);
        });
    });
});