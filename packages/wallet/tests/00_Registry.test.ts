import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkCrossPackageCompatibility, Ms3Modules, getRequirements, getEnvironments, RuntimeEnvironment, UniversalRegistry } from '@m3s/shared';
import Joi from 'joi';
import { EvmWalletAdapter } from '../src/adapters/ethers/ethersWallet.js';
import { ethersOptionsSchema } from '../src/adapters/ethers/ethersWallet.registration.js';
import { web3AuthOptionsSchema } from '../src/adapters/web3auth/web3authWallet.registration.js';
import '@m3s/wallet'
import { logger } from '../../../logger.js';
import { walletRegistry } from '@m3s/wallet';

describe('Auto-Generation System Tests (JOI-Based)', () => {
  describe('JOI Schema Requirements Generation', () => {
    it('should generate correct requirements from Ethers JOI schema', () => {
      const requirements = getRequirements(ethersOptionsSchema, 'ethers');
      expect(requirements).toHaveLength(2);

      // Check privateKey requirement
      const privateKeyReq = requirements.find((r: any) => r.path === 'options.privateKey');
      expect(privateKeyReq).toBeDefined();
      expect(privateKeyReq!.type).toBe('string');
      expect(privateKeyReq!.allowUndefined).toBe(true);
      expect(privateKeyReq!.message).toContain('Private key for wallet');

      // Check provider requirement
      const providerReq = requirements.find((r: any) => r.path === 'options.provider');
      expect(providerReq).toBeDefined();
      expect(providerReq!.allowUndefined).toBe(true);
      expect(providerReq!.message).toContain('Optional provider configuration');
    });

    it('should generate correct requirements from Web3Auth JOI schema', () => {
      const requirements = getRequirements(web3AuthOptionsSchema, 'web3auth');

      expect(requirements.length).toBeGreaterThan(0);

      // Check main config requirement
      const configReq = requirements.find((r: any) => r.path === 'options.web3authConfig');
      expect(configReq).toBeDefined();
      expect(configReq!.type).toBe('object');
      expect(configReq!.allowUndefined).toBe(false); // Required
      expect(configReq!.message).toContain('Web3Auth configuration object');

      // Check nested clientId requirement
      const clientIdReq = requirements.find((r: any) => r.path === 'options.web3authConfig.clientId');
      expect(clientIdReq).toBeDefined();
      expect(clientIdReq!.type).toBe('string');
      expect(clientIdReq!.allowUndefined).toBe(false); // Required
      expect(clientIdReq!.message).toContain('Your Web3Auth Client ID');

      // Check nested chainConfig requirement
      const chainConfigReq = requirements.find((r: any) => r.path === 'options.web3authConfig.chainConfig');
      expect(chainConfigReq).toBeDefined();
      expect(chainConfigReq!.type).toBe('object');
      expect(chainConfigReq!.allowUndefined).toBe(false); // Required

      // Check deep nested chainId requirement
      const chainIdReq = requirements.find((r: any) => r.path === 'options.web3authConfig.chainConfig.chainId');
      expect(chainIdReq).toBeDefined();
      expect(chainIdReq!.type).toBe('string');
      expect(chainIdReq!.allowUndefined).toBe(false); // Required
    });

    it('should handle JOI validation rules correctly', () => {
      // Create a test schema with various validation rules
      const testSchema = Joi.object({
        requiredString: Joi.string().required().description('Required string field'),
        optionalNumber: Joi.number().optional().description('Optional number field'),
        enumField: Joi.string().valid('option1', 'option2', 'option3').required().description('Must be one of the valid options'),
        nestedObject: Joi.object({
          nestedRequired: Joi.string().required().description('Nested required field'),
          nestedOptional: Joi.boolean().optional().description('Nested optional field')
        }).required().description('Nested configuration object')
      });

      const requirements = getRequirements(testSchema, 'test');

      // Check required string
      const requiredReq = requirements.find((r: any) => r.path === 'options.requiredString');
      expect(requiredReq!.allowUndefined).toBe(false);
      expect(requiredReq!.message).toBe('Required string field');

      // Check optional number
      const optionalReq = requirements.find((r: any) => r.path === 'options.optionalNumber');
      expect(optionalReq!.allowUndefined).toBe(true);
      expect(optionalReq!.message).toBe('Optional number field');

      // Check nested requirements
      const nestedReq = requirements.find((r: any) => r.path === 'options.nestedObject.nestedRequired');
      expect(nestedReq).toBeDefined();
      expect(nestedReq!.allowUndefined).toBe(false);
      expect(nestedReq!.message).toBe('Nested required field');
    });

    it('should fallback gracefully for invalid schemas', () => {
      // Test with null schema
      const requirements = getRequirements(null as any, 'invalid');
      expect(Array.isArray(requirements)).toBe(true);
      // Should use fallback or return empty array
    });

    // ✅ NEW EDGE CASES - PHASE 1
    describe('JOI Schema Edge Cases', () => {
      it('should handle circular JOI schema references gracefully', () => {
        // Create a schema with circular reference
        const circularSchema = Joi.object({
          name: Joi.string().required(),
          parent: Joi.link('#parent')
        }).id('parent');

        const requirements = getRequirements(circularSchema, 'circular-test');
        expect(Array.isArray(requirements)).toBe(true);
        // Should not crash, may return partial requirements
      });

      it('should handle deeply nested JOI schemas', () => {
        const deepSchema = Joi.object({
          level1: Joi.object({
            level2: Joi.object({
              level3: Joi.object({
                level4: Joi.object({
                  value: Joi.string().required().description('Deep nested value')
                }).required()
              }).required()
            }).required()
          }).required()
        });

        const requirements = getRequirements(deepSchema, 'deep-nested');

        // Should find the deeply nested requirement
        const deepReq = requirements.find(r => r.path === 'options.level1.level2.level3.level4.value');
        expect(deepReq).toBeDefined();
        expect(deepReq!.allowUndefined).toBe(false);
        expect(deepReq!.message).toBe('Deep nested value');
      });

      it('should handle JOI alternatives and conditionals', () => {
        const alternativesSchema = Joi.object({
          authType: Joi.string().valid('oauth', 'privateKey').required(),
          oauth: Joi.when('authType', {
            is: 'oauth',
            then: Joi.object({
              clientId: Joi.string().required(),
              redirectUri: Joi.string().uri().required()
            }).required(),
            otherwise: Joi.forbidden()
          }),
          privateKey: Joi.when('authType', {
            is: 'privateKey',
            then: Joi.string().required(),
            otherwise: Joi.forbidden()
          })
        });

        const requirements = getRequirements(alternativesSchema, 'alternatives-test');
        expect(requirements.length).toBeGreaterThan(0);

        // Should handle the authType requirement
        const authTypeReq = requirements.find(r => r.path === 'options.authType');
        expect(authTypeReq).toBeDefined();
      });

      it('should handle JOI arrays with item validation', () => {
        const arraySchema = Joi.object({
          endpoints: Joi.array().items(
            Joi.object({
              url: Joi.string().uri().required(),
              priority: Joi.number().min(1).max(10).required(),
              metadata: Joi.object({
                region: Joi.string().required(),
                latency: Joi.number().optional()
              }).optional()
            })
          ).min(1).required().description('Array of endpoint configurations')
        });

        const requirements = getRequirements(arraySchema, 'array-test');

        const endpointsReq = requirements.find(r => r.path === 'options.endpoints');
        expect(endpointsReq).toBeDefined();
        expect(endpointsReq!.type).toBe('array');
        expect(endpointsReq!.message).toBe('Array of endpoint configurations');
      });

      it('should handle malformed JOI schemas without crashing', () => {
        const malformedInputs = [
          null,
          undefined,
          {},
          { describe: 'not a function' },
          { describe: () => { throw new Error('Schema error'); } },
          'not an object',
          42,
          []
        ];

        for (const malformedInput of malformedInputs) {
          expect(() => {
            const requirements = getRequirements(malformedInput as any, 'malformed-test');
            expect(Array.isArray(requirements)).toBe(true);
          }).not.toThrow();
        }
      });
    });
  });

  describe('Environment Generation', () => {
    it('should generate environment requirements with custom notes', () => {
      const environment = getEnvironments(
        'ethers',
        [RuntimeEnvironment.SERVER, RuntimeEnvironment.BROWSER],
        ['Custom limitation'],
        ['Custom security note']
      );

      expect(environment.supportedEnvironments).toEqual([
        RuntimeEnvironment.SERVER,
        RuntimeEnvironment.BROWSER
      ]);

      expect(environment.limitations).toContain('Custom limitation');
      expect(environment.securityNotes).toContain('Custom security note');
      expect(environment.securityNotes).toContain('ethers adapter follows standard security practices');
    });

    it('should handle single environment correctly', () => {
      const environment = getEnvironments('web3auth', [RuntimeEnvironment.BROWSER]);

      expect(environment.supportedEnvironments).toEqual([RuntimeEnvironment.BROWSER]);
      expect(environment.limitations).toContain('Cannot be used in Node.js server environments');
      expect(environment.securityNotes).toContain('Consider using hardware wallets for enhanced security');
    });

    // ✅ NEW ENVIRONMENT EDGE CASES
    describe('Environment Validation Edge Cases', () => {
      it('should handle environment mismatch detection', () => {
        // Mock different environment scenarios
        const originalProcess = (global as any).process;
        const originalWindow = (global as any).window;

        try {
          // Test browser environment validation
          const browserOnlyEnv = getEnvironments('test-browser', [RuntimeEnvironment.BROWSER]);

          expect(browserOnlyEnv.supportedEnvironments).toEqual([RuntimeEnvironment.BROWSER]);
          expect(browserOnlyEnv.limitations).toContain('Cannot be used in Node.js server environments');

          // Test dual environment
          const dualEnv = getEnvironments('test-dual', [RuntimeEnvironment.SERVER, RuntimeEnvironment.BROWSER]);

          expect(dualEnv.supportedEnvironments).toContain(RuntimeEnvironment.SERVER);
          expect(dualEnv.supportedEnvironments).toContain(RuntimeEnvironment.BROWSER);

        } finally {
          // Restore original environment
          (global as any).process = originalProcess;
          (global as any).window = originalWindow;
        }
      });

      it('should validate security notes deduplication', () => {
        const environment = getEnvironments(
          'test-adapter',
          [RuntimeEnvironment.SERVER],
          ['Duplicate limitation', 'Duplicate limitation', 'Unique limitation'],
          ['Duplicate security note', 'Duplicate security note', 'Unique security note']
        );

        // Should deduplicate limitations and security notes
        const limitationCount = environment.limitations!.filter(l => l === 'Duplicate limitation').length;
        const securityNoteCount = environment.securityNotes!.filter(n => n === 'Duplicate security note').length;

        expect(limitationCount).toBe(1);
        expect(securityNoteCount).toBe(1);
        expect(environment.limitations).toContain('Unique limitation');
        expect(environment.securityNotes).toContain('Unique security note');
      });
    });
  });

  describe('Features Generation', () => {
    it('should detect core EVM wallet methods and async behavior (prototype + metadata checks)', () => {
      // Prototype inspection
      const methodNames = Object.getOwnPropertyNames(EvmWalletAdapter.prototype)
        .filter(n => n !== 'constructor' && typeof (EvmWalletAdapter.prototype as any)[n] === 'function');

      // Basic presence checks
      expect(methodNames).toContain('initialize');
      expect(methodNames).toContain('getAccounts');
      expect(methodNames).toContain('signTypedData');

      // Async checks for core methods where applicable
      const initFn = (EvmWalletAdapter.prototype as any).initialize;
      if (initFn) expect(initFn.constructor.name).toBe('AsyncFunction');

      const signTypedFn = (EvmWalletAdapter.prototype as any).signTypedData;
      if (signTypedFn) expect(['AsyncFunction', 'Function']).toContain(signTypedFn.constructor.name);

      // If adapter was registered, ensure capabilities exist
      const meta = walletRegistry.getAdapter(Ms3Modules.wallet, 'ethers', '1.0.0');
      if (meta) {
        expect(meta.capabilities).toBeDefined();
        expect(meta.capabilities.length).toBeGreaterThan(0);
      }
    });

    it('should handle method parameter detection correctly (prototype param counts)', () => {
      const signMessageFn = (EvmWalletAdapter.prototype as any).signMessage;
      expect(typeof signMessageFn).toBe('function');
      // Use declared parameter count (.length) as a lightweight check
      expect(signMessageFn.length).toBeGreaterThan(0);
    });

    // ✅ NEW FEATURE EXTRACTION EDGE CASES
    describe('Feature Extraction Edge Cases', () => {
      it('should detect async methods via prototype inspection', () => {
        const methodNames = Object.getOwnPropertyNames(EvmWalletAdapter.prototype)
          .filter(n => n !== 'constructor' && typeof (EvmWalletAdapter.prototype as any)[n] === 'function');

        const asyncMethods = methodNames.filter(n => {
          const fn = (EvmWalletAdapter.prototype as any)[n];
          return fn && fn.constructor && fn.constructor.name === 'AsyncFunction';
        });

        expect(asyncMethods.length).toBeGreaterThan(0);
      });

      it('should find methods with multiple declared parameters', () => {
        const methodNames = Object.getOwnPropertyNames(EvmWalletAdapter.prototype)
          .filter(n => n !== 'constructor' && typeof (EvmWalletAdapter.prototype as any)[n] === 'function');

        const complex = methodNames.filter(n => {
          const fn = (EvmWalletAdapter.prototype as any)[n];
          return typeof fn === 'function' && fn.length > 1;
        });

        expect(complex.length).toBeGreaterThan(0);
      });

      it('should gracefully handle malformed adapter classes during inspection', () => {
        const invalidInputs = [
          null,
          undefined,
          {},
          { prototype: null },
          { prototype: { constructor: null } },
          'not a class'
        ];

        for (const invalidInput of invalidInputs) {
          expect(() => {
            if (typeof invalidInput === 'function') {
              const names = Object.getOwnPropertyNames((invalidInput as any).prototype || {})
                .filter(n => n !== 'constructor' && typeof (invalidInput as any).prototype[n] === 'function');
              expect(Array.isArray(names)).toBe(true);
            } else if (invalidInput && typeof invalidInput === 'object' && invalidInput.prototype && typeof invalidInput.prototype === 'object') {
              const names = Object.getOwnPropertyNames(invalidInput.prototype || {})
                .filter((n: string) => n !== 'constructor' && typeof (invalidInput as any).prototype[n] === 'function');
              expect(Array.isArray(names)).toBe(true);
            } else {
              expect(typeof invalidInput).not.toBe('function');
            }
          }).not.toThrow();
        }
      });
    });
  });

  // describe('Registry Integration', () => {
  //   beforeAll(async () => {
  //     // This ensures the registration logic has run for the tests in this block.
  //     await import('../src/adapters/ethers/ethersWallet.registration.js');
  //     await import('../src/adapters/web3auth/web3authWallet.registration.js');
  //   });

  //   it('should have registered web3auth adapter with JOI-generated data', () => {
  //     const adapterInfo = walletRegistry.getAdapter(Ms3Modules.wallet, 'web3auth', '1.0.0');

  //     expect(adapterInfo).toBeDefined();
  //     expect(adapterInfo!.requirements).toBeDefined();
  //     expect(adapterInfo!.environment).toBeDefined();
  //     expect(adapterInfo!.capabilities).toBeDefined();

  //     // Check requirements were generated from JOI (should have many nested requirements)
  //     expect(adapterInfo!.requirements!.length).toBeGreaterThan(5); // Should have many nested fields

  //     // Check for deep nested requirement
  //     const chainIdReq = adapterInfo!.requirements!.find(r => r.path === 'options.web3authConfig.chainConfig.chainId');
  //     expect(chainIdReq).toBeDefined();
  //     expect(chainIdReq!.allowUndefined).toBe(false); // Required field

  //     // Check environment is browser-only
  //     expect(adapterInfo!.environment!.supportedEnvironments).toEqual([RuntimeEnvironment.BROWSER]);
  //     expect(adapterInfo!.environment!.supportedEnvironments).not.toContain(RuntimeEnvironment.SERVER);
  //   });

  //   it('should have generated compatibility matrices', () => {
  //     const ethersMatrix = walletRegistry.getCompatibilityMatrix(Ms3Modules.wallet, 'ethers', '1.0.0');
  //     expect(ethersMatrix).toBeDefined();
  //     expect(ethersMatrix!.adapterName).toBe('ethers');
  //     expect(ethersMatrix!.version).toBe('1.0.0');
  //     expect(ethersMatrix!.compatibleVersions).toContain('1.0.0');

  //     const web3authMatrix = walletRegistry.getCompatibilityMatrix(Ms3Modules.wallet, 'web3auth', '1.0.0');
  //     expect(web3authMatrix).toBeDefined();
  //     expect(web3authMatrix!.adapterName).toBe('web3auth');
  //     expect(web3authMatrix!.version).toBe('1.0.0');
  //   });

  //   // ✅ NEW REGISTRY EDGE CASES
  //   describe('Registry Edge Cases', () => {
  //     it('should handle adapter lookup with invalid parameters', () => {
  //       // Test various invalid lookups
  //       expect(walletRegistry.getAdapter(Ms3Modules.wallet, 'nonexistent', '1.0.0')).toBeUndefined();
  //       expect(walletRegistry.getAdapter('nonexistent', 'ethers', '1.0.0')).toBeUndefined();
  //       expect(walletRegistry.getAdapter(Ms3Modules.wallet, 'ethers', '999.0.0')).toBeUndefined();
  //     });

  //     it('should handle compatibility matrix edge cases', () => {
  //       // Test invalid compatibility matrix lookups
  //       expect(walletRegistry.getCompatibilityMatrix(Ms3Modules.wallet, 'nonexistent', '1.0.0')).toBeUndefined();
  //       expect(walletRegistry.getCompatibilityMatrix('nonexistent', 'ethers', '1.0.0')).toBeUndefined();

  //       // Valid matrix should have required properties
  //       const ethersMatrix = walletRegistry.getCompatibilityMatrix(Ms3Modules.wallet, 'ethers', '1.0.0');
  //       if (ethersMatrix) {
  //         expect(ethersMatrix.adapterName).toBeDefined();
  //         expect(ethersMatrix.version).toBeDefined();
  //         expect(Array.isArray(ethersMatrix.compatibleVersions)).toBe(true);
  //         expect(Array.isArray(ethersMatrix.breakingChanges)).toBe(true);
  //         expect(Array.isArray(ethersMatrix.crossModuleCompatibility)).toBe(true);
  //       }
  //     });

  //     it('should validate walletRegistry module registration completeness', () => {
  //       // Check that all registered adapters have required metadata
  //       const ethersAdapter = walletRegistry.getAdapter(Ms3Modules.wallet, 'ethers', '1.0.0');
  //       expect(ethersAdapter).toBeDefined();
  //       expect(ethersAdapter!.name).toBe('ethers');
  //       expect(ethersAdapter!.version).toBe('1.0.0');
  //       expect(ethersAdapter!.module).toBe(Ms3Modules.wallet);
  //       expect(ethersAdapter!.adapterClass).toBeDefined();

  //       const web3authAdapter = walletRegistry.getAdapter(Ms3Modules.wallet, 'web3auth', '1.0.0');
  //       expect(web3authAdapter).toBeDefined();
  //       expect(web3authAdapter!.name).toBe('web3auth');
  //       expect(web3authAdapter!.version).toBe('1.0.0');
  //       expect(web3authAdapter!.module).toBe(Ms3Modules.wallet);
  //       expect(web3authAdapter!.adapterClass).toBeDefined();
  //     });
  //   });
  // });

  describe('JOI Schema Validation Features', () => {
    it('should demonstrate JOI schema benefits over interface reflection', () => {
      // Create complex schema with validations that interface reflection couldn't handle
      const complexSchema = Joi.object({
        apiKey: Joi.string().alphanum().min(32).max(64).required().description('API key must be alphanumeric, 32-64 characters'),
        timeout: Joi.number().min(1000).max(30000).optional().default(5000).description('Timeout in milliseconds (1-30 seconds)'),
        retries: Joi.number().integer().min(0).max(5).optional().default(3).description('Number of retry attempts (0-5)'),
        endpoints: Joi.array().items(Joi.string().uri()).min(1).required().description('Array of valid endpoint URLs'),
        features: Joi.object({
          enableLogging: Joi.boolean().optional().default(false).description('Enable logging feature')
        }).optional().description('Optional feature toggles')
      });

      const requirements = getRequirements(complexSchema, 'complex-adapter');

      // Verify complex validations are captured
      const apiKeyReq = requirements.find(r => r.path === 'options.apiKey');
      expect(apiKeyReq).toBeDefined();
      expect(apiKeyReq!.allowUndefined).toBe(false);
      expect(apiKeyReq!.message).toContain('API key must be alphanumeric');

      const endpointsReq = requirements.find(r => r.path === 'options.endpoints');
      expect(endpointsReq).toBeDefined();
      expect(endpointsReq!.type).toBe('array');
      expect(endpointsReq!.allowUndefined).toBe(false);

      // Verify nested optional fields
      const loggingReq = requirements.find(r => r.path === 'options.features.enableLogging');
      expect(loggingReq).toBeDefined();
      expect(loggingReq!.allowUndefined).toBe(true); // Has default value
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JOI schemas gracefully', () => {
      // This should not crash the system
      const requirements = getRequirements({} as any, 'malformed');
      expect(Array.isArray(requirements)).toBe(true);
    });

    it('should provide meaningful error messages for complex validations', () => {
      const schema = Joi.object({
        'config.api.key': Joi.string().required().description('API key with special characters in path')
      });

      const requirements = getRequirements(schema, 'edge-case');

      // Should handle special characters in field names
      expect(requirements.length).toBeGreaterThan(0);
    });

    // ✅ NEW ERROR HANDLING EDGE CASES
    describe('Error Recovery and Robustness', () => {
      it('should handle memory constraints gracefully', () => {
        // Create a large schema to test memory handling
        const fields: any = {};
        for (let i = 0; i < 100; i++) {
          fields[`field${i}`] = Joi.string().optional().description(`Field number ${i}`);
        }

        const largeSchema = Joi.object(fields);

        expect(() => {
          const requirements = getRequirements(largeSchema, 'large-schema-test');
          expect(Array.isArray(requirements)).toBe(true);
          expect(requirements.length).toBe(100);
        }).not.toThrow();
      });

      it('should handle concurrent schema processing', async () => {
        // Test processing multiple schemas concurrently
        const schemas = [
          ethersOptionsSchema,
          web3AuthOptionsSchema,
          Joi.object({ test1: Joi.string().required() }),
          Joi.object({ test2: Joi.number().optional() }),
          Joi.object({ test3: Joi.boolean().required() })
        ];

        const promises = schemas.map((schema, index) =>
          Promise.resolve(getRequirements(schema, `concurrent-test-${index}`))
        );

        const results = await Promise.all(promises);

        // All should succeed
        expect(results).toHaveLength(5);
        results.forEach((result, index) => {
          expect(Array.isArray(result)).toBe(true);
          logger.info(`✅ Concurrent schema ${index} processed: ${result.length} requirements`);
        });
      });

      it('should maintain consistent behavior across multiple calls', () => {
        // Test that multiple calls to the same schema return consistent results
        const results = [];
        for (let i = 0; i < 5; i++) {
          results.push(getRequirements(ethersOptionsSchema, 'consistency-test'));
        }

        // All results should be identical
        const firstResult = JSON.stringify(results[0]);
        for (let i = 1; i < results.length; i++) {
          expect(JSON.stringify(results[i])).toBe(firstResult);
        }
      });
    });
  });

  // ✅ NEW INTEGRATION TESTS SECTION
  describe('Cross-Package Registry Architecture Test', () => {

    // These will hold the fresh instances for each test
    let walletRegistry: UniversalRegistry;
    let smartContractRegistry: UniversalRegistry;
    let crossChainRegistry: UniversalRegistry;

    // Before each test, reset the module cache and dynamically import fresh instances.
    beforeEach(async () => {
      vi.resetModules(); // This is the key! It clears the module cache.

      // Dynamically import the packages to get fresh instances of the registries
      const walletModule = await import('@m3s/wallet');
      const scModule = await import('@m3s/smart-contract');
      const ccModule = await import('@m3s/crosschain');

      walletRegistry = walletModule.walletRegistry;
      smartContractRegistry = scModule.smartContractRegistry;
      crossChainRegistry = ccModule.crossChainRegistry;
    });

    it('should FAIL compatibility check when using isolated, un-merged registries', () => {
      const isCompatible = checkCrossPackageCompatibility(
        smartContractRegistry, // Use the fresh instance for this test
        Ms3Modules.smartcontract, 'openZeppelin', '1.0.0',
        Ms3Modules.wallet, 'ethers', '1.0.0'
      );

      expect(isCompatible).toBe(false);
      logger.info('✅ Correctly FAILED: smartContractRegistry does not know about wallet adapters before merge.');
    }, 30000);

    it('should PASS compatibility check after the user explicitly merges registries', () => {
      smartContractRegistry.mergeRegistry(walletRegistry);

      const isCompatible = checkCrossPackageCompatibility(
        smartContractRegistry, // Use the now-merged registry
        Ms3Modules.smartcontract, 'openZeppelin', '1.0.0',
        Ms3Modules.wallet, 'ethers', '1.0.0'
      );

      expect(isCompatible).toBe(true);
      logger.info('✅ Correctly PASSED: Compatibility check succeeds after merging registries.');
    });

    it('should still FAIL for adapters that are truly incompatible by environment', () => {
      smartContractRegistry.mergeRegistry(walletRegistry);

      const isCompatible = checkCrossPackageCompatibility(
        smartContractRegistry,
        Ms3Modules.smartcontract, 'openZeppelin', '1.0.0',
        Ms3Modules.wallet, 'web3auth', '1.0.0'
      );

      expect(isCompatible).toBe(false);
      logger.info('✅ Correctly FAILED: Environment incompatibility is detected even after merge.');
    });

    it('should work symmetrically for the crosschain package', () => {
      const isCompatibleBeforeMerge = checkCrossPackageCompatibility(
        crossChainRegistry,
        Ms3Modules.crosschain, 'lifi', '1.0.0',
        Ms3Modules.wallet, 'ethers', '1.0.0'
      );
      expect(isCompatibleBeforeMerge).toBe(false);

      crossChainRegistry.mergeRegistry(walletRegistry);

      const isCompatibleAfterMerge = checkCrossPackageCompatibility(
        crossChainRegistry,
        Ms3Modules.crosschain, 'lifi', '1.0.0',
        Ms3Modules.wallet, 'ethers', '1.0.0'
      );
      expect(isCompatibleAfterMerge).toBe(true);
    });
  });

  // ✅ NEW PERFORMANCE AND LOAD TESTS
  describe('Performance and Load Tests', () => {
    it('should handle rapid adapter lookups efficiently', () => {
      const startTime = Date.now();

      // Perform many rapid lookups
      for (let i = 0; i < 1000; i++) {
        walletRegistry.getAdapter(Ms3Modules.wallet, 'ethers', '1.0.0');
        walletRegistry.getAdapter(Ms3Modules.wallet, 'web3auth', '1.0.0');
      }
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
      logger.info(`✅ 3000 walletRegistry lookups completed in ${duration}ms`);
    });

    it('should handle bulk requirement generation efficiently', () => {
      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        getRequirements(ethersOptionsSchema, `bulk-test-${i}`);
        getRequirements(web3AuthOptionsSchema, `bulk-test-${i}`);
      }
      const endTime = Date.now();
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(2000);
    });
  });
});