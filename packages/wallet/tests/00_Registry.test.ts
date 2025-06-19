import { describe, it, expect, beforeAll, vi } from 'vitest';
import { registry } from '@m3s/common';
import { getRequirements, getEnvironments, getFeatures } from '@m3s/common';
import { EvmWalletAdapter } from '../src/adapters/ethers/ethersWallet.js';
import { RuntimeEnvironment } from '@m3s/common';
import { ethersOptionsSchema } from '../src/adapters/ethers/ethersWallet.registration.js';
import { web3AuthOptionsSchema } from '../src/adapters/web3auth/web3authWallet.registration.js';
import Joi from 'joi';

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
    it('should extract method signatures from adapter class', () => {
      const features = getFeatures(EvmWalletAdapter);

      expect(features.length).toBeGreaterThan(0);
      
      // Check for core methods
      const initMethod = features.find(f => f.name === 'initialize');
      expect(initMethod).toBeDefined();
      expect(initMethod!.returnType.includes('Promise') || initMethod!.isAsync).toBe(true);
      expect(initMethod!.isAsync).toBe(true);

      const getAccountsMethod = features.find(f => f.name === 'getAccounts');
      expect(getAccountsMethod).toBeDefined();
      expect(getAccountsMethod!.returnType.includes('Promise') || getAccountsMethod!.isAsync).toBe(true);

      // Check for EVM-specific methods
      const signTypedDataMethod = features.find(f => f.name === 'signTypedData');
      expect(signTypedDataMethod).toBeDefined();
      expect(
        signTypedDataMethod!.returnType.includes('Promise<string>') || 
        signTypedDataMethod!.returnType.includes('Promise') || 
        signTypedDataMethod!.isAsync
      ).toBe(true);
    });

    it('should handle method parameters correctly', () => {
      const features = getFeatures(EvmWalletAdapter);
      
      const signMessageMethod = features.find((f: any) => f.name === 'signMessage');
      expect(signMessageMethod).toBeDefined();
      expect(signMessageMethod!.parameters.length).toBeGreaterThan(0);
      expect(signMessageMethod!.parameters[0].name).toBeDefined();
    });

    // ✅ NEW FEATURE EXTRACTION EDGE CASES
    describe('Feature Extraction Edge Cases', () => {
      it('should handle async method detection correctly', () => {
        const features = getFeatures(EvmWalletAdapter);
        
        // All wallet methods should be properly marked as async or not
        const asyncMethods = features.filter(f => f.isAsync);
        const nonAsyncMethods = features.filter(f => !f.isAsync);
        
        // Most wallet methods are async
        expect(asyncMethods.length).toBeGreaterThan(0);
        
        // Check specific async methods
        const sendTxMethod = features.find(f => f.name === 'sendTransaction');
        if (sendTxMethod) {
          expect(sendTxMethod.isAsync).toBe(true);
          expect(sendTxMethod.returnType).toMatch(/Promise/i);
        }
      });

      it('should handle method parameter extraction for complex signatures', () => {
        const features = getFeatures(EvmWalletAdapter);
        
        // Find methods with multiple parameters
        const complexMethods = features.filter(f => f.parameters.length > 1);
        expect(complexMethods.length).toBeGreaterThan(0);
        
        // Check setProvider method parameters
        const setProviderMethod = features.find(f => f.name === 'setProvider');
        if (setProviderMethod) {
          expect(setProviderMethod.parameters.length).toBeGreaterThan(0);
          expect(setProviderMethod.parameters[0].name).toBeDefined();
        }
      });

      it('should gracefully handle malformed adapter classes', () => {
        // Test with various invalid inputs
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
            const features = getFeatures(invalidInput as any);
            expect(Array.isArray(features)).toBe(true);
          }).not.toThrow();
        }
      });
    });
  });

  describe('Registry Integration', () => {
    beforeAll(async () => {
      // Import registrations to ensure adapters are registered
      await import('../src/adapters/ethers/ethersWallet.registration.js');
      await import('../src/adapters/web3auth/web3authWallet.registration.js');
    });

    it('should have registered web3auth adapter with JOI-generated data', () => {
      const adapterInfo = registry.getAdapter('wallet', 'web3auth', '1.0.0');
      
      expect(adapterInfo).toBeDefined();
      expect(adapterInfo!.requirements).toBeDefined();
      expect(adapterInfo!.environment).toBeDefined();
      expect(adapterInfo!.features).toBeDefined();
      
      // Check requirements were generated from JOI (should have many nested requirements)
      expect(adapterInfo!.requirements!.length).toBeGreaterThan(5); // Should have many nested fields
      
      // Check for deep nested requirement
      const chainIdReq = adapterInfo!.requirements!.find(r => r.path === 'options.web3authConfig.chainConfig.chainId');
      expect(chainIdReq).toBeDefined();
      expect(chainIdReq!.allowUndefined).toBe(false); // Required field
      
      // Check environment is browser-only
      expect(adapterInfo!.environment!.supportedEnvironments).toEqual([RuntimeEnvironment.BROWSER]);
      expect(adapterInfo!.environment!.supportedEnvironments).not.toContain(RuntimeEnvironment.SERVER);
    });

    it('should have generated compatibility matrices', () => {
      const ethersMatrix = registry.getCompatibilityMatrix('wallet', 'ethers', '1.0.0');
      expect(ethersMatrix).toBeDefined();
      expect(ethersMatrix!.adapterName).toBe('ethers');
      expect(ethersMatrix!.version).toBe('1.0.0');
      expect(ethersMatrix!.compatibleVersions).toContain('1.0.0');

      const web3authMatrix = registry.getCompatibilityMatrix('wallet', 'web3auth', '1.0.0');
      expect(web3authMatrix).toBeDefined();
      expect(web3authMatrix!.adapterName).toBe('web3auth');
      expect(web3authMatrix!.version).toBe('1.0.0');
    });

    // ✅ NEW REGISTRY EDGE CASES
    describe('Registry Edge Cases', () => {
      it('should handle adapter lookup with invalid parameters', () => {
        // Test various invalid lookups
        expect(registry.getAdapter('wallet', 'nonexistent', '1.0.0')).toBeUndefined();
        expect(registry.getAdapter('nonexistent', 'ethers', '1.0.0')).toBeUndefined();
        expect(registry.getAdapter('wallet', 'ethers', '999.0.0')).toBeUndefined();
      });

      it('should handle compatibility matrix edge cases', () => {
        // Test invalid compatibility matrix lookups
        expect(registry.getCompatibilityMatrix('wallet', 'nonexistent', '1.0.0')).toBeUndefined();
        expect(registry.getCompatibilityMatrix('nonexistent', 'ethers', '1.0.0')).toBeUndefined();
        
        // Valid matrix should have required properties
        const ethersMatrix = registry.getCompatibilityMatrix('wallet', 'ethers', '1.0.0');
        if (ethersMatrix) {
          expect(ethersMatrix.adapterName).toBeDefined();
          expect(ethersMatrix.version).toBeDefined();
          expect(Array.isArray(ethersMatrix.compatibleVersions)).toBe(true);
          expect(Array.isArray(ethersMatrix.breakingChanges)).toBe(true);
          expect(Array.isArray(ethersMatrix.crossModuleCompatibility)).toBe(true);
        }
      });

      it('should validate registry module registration completeness', () => {
        // Check that all registered adapters have required metadata
        const ethersAdapter = registry.getAdapter('wallet', 'ethers', '1.0.0');
        expect(ethersAdapter).toBeDefined();
        expect(ethersAdapter!.name).toBe('ethers');
        expect(ethersAdapter!.version).toBe('1.0.0');
        expect(ethersAdapter!.module).toBe('wallet');
        expect(ethersAdapter!.adapterClass).toBeDefined();
        
        const web3authAdapter = registry.getAdapter('wallet', 'web3auth', '1.0.0');
        expect(web3authAdapter).toBeDefined();
        expect(web3authAdapter!.name).toBe('web3auth');
        expect(web3authAdapter!.version).toBe('1.0.0');
        expect(web3authAdapter!.module).toBe('wallet');
        expect(web3authAdapter!.adapterClass).toBeDefined();
      });
    });
  });

  describe('JOI Schema Validation Features', () => {
    it('should demonstrate JOI schema benefits over interface reflection', () => {
      // Create complex schema with validations that interface reflection couldn't handle
      const complexSchema = Joi.object({
        apiKey: Joi.string().alphanum().min(32).max(64).required().description('API key must be alphanumeric, 32-64 characters'),
        timeout: Joi.number().min(1000).max(30000).optional().default(5000).description('Timeout in milliseconds (1-30 seconds)'),
        retries: Joi.number().integer().min(0).max(5).optional().default(3).description('Number of retry attempts (0-5)'),
        endpoints: Joi.array().items(Joi.string().uri()).min(1).required().description('Array of valid endpoint URLs'),
        features: Joi.object({
          enableLogging: Joi.boolean().default(true).description('Enable request logging'),
          compression: Joi.string().valid('gzip', 'deflate', 'br').optional().description('Compression algorithm')
        }).optional().description('Optional feature configuration')
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
          console.log(`✅ Concurrent schema ${index} processed: ${result.length} requirements`);
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
  describe('Cross-Package Integration Tests', () => {
    it('should validate wallet adapter compatibility with smart-contract module', async () => {
      const { checkCrossPackageCompatibility } = await import('@m3s/common');
      
      // Test ethers wallet compatibility with smart contract module
      const ethersToSC = checkCrossPackageCompatibility(
        'wallet', 'ethers', '1.0.0',
        'smart-contract', 'openZeppelin', '1.0.0'
      );
      expect(ethersToSC).toBe(true);
      
      // Test web3auth wallet compatibility with smart contract module
      const web3authToSC = checkCrossPackageCompatibility(
        'wallet', 'web3auth', '1.0.0',
        'smart-contract', 'openZeppelin', '1.0.0'
      );
      expect(web3authToSC).toBe(true);
    });

    it('should validate wallet adapter compatibility with crosschain module', async () => {
      const { checkCrossPackageCompatibility } = await import('@m3s/common');
      
      // Test ethers wallet compatibility with crosschain module
      const ethersToCrosschain = checkCrossPackageCompatibility(
        'wallet', 'ethers', '1.0.0',
        'crosschain', 'lifi', '1.0.0'
      );
      expect(ethersToCrosschain).toBe(true);
      
      // Test web3auth incompatibility with crosschain (environment mismatch)
      const web3authToCrosschain = checkCrossPackageCompatibility(
        'wallet', 'web3auth', '1.0.0',
        'crosschain', 'lifi', '1.0.0'
      );
      expect(web3authToCrosschain).toBe(false); // Environment incompatibility
    });

    it('should handle environment-based compatibility validation', async () => {
      // Test that environment requirements are properly enforced in compatibility
      const ethersEnv = registry.getEnvironmentRequirements('wallet', 'ethers', '1.0.0');
      const web3authEnv = registry.getEnvironmentRequirements('wallet', 'web3auth', '1.0.0');
      
      expect(ethersEnv?.supportedEnvironments).toContain(RuntimeEnvironment.SERVER);
      expect(ethersEnv?.supportedEnvironments).toContain(RuntimeEnvironment.BROWSER);
      
      expect(web3authEnv?.supportedEnvironments).toContain(RuntimeEnvironment.BROWSER);
      expect(web3authEnv?.supportedEnvironments).not.toContain(RuntimeEnvironment.SERVER);
    });
  });

  // ✅ NEW PERFORMANCE AND LOAD TESTS
  describe('Performance and Load Tests', () => {
    it('should handle rapid adapter lookups efficiently', () => {
      const startTime = Date.now();
      
      // Perform many rapid lookups
      for (let i = 0; i < 1000; i++) {
        registry.getAdapter('wallet', 'ethers', '1.0.0');
        registry.getAdapter('wallet', 'web3auth', '1.0.0');
        registry.getCompatibilityMatrix('wallet', 'ethers', '1.0.0');
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
      console.log(`✅ 3000 registry lookups completed in ${duration}ms`);
    });

    it('should handle bulk requirement generation efficiently', () => {
      const startTime = Date.now();
      
      // Generate requirements for many schemas
      for (let i = 0; i < 100; i++) {
        getRequirements(ethersOptionsSchema, `bulk-test-${i}`);
        getRequirements(web3AuthOptionsSchema, `bulk-test-${i}`);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(2000);
      console.log(`✅ 200 requirement generations completed in ${duration}ms`);
    });
  });
});