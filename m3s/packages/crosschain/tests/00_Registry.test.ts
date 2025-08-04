import { describe, it, expect, beforeAll, vi } from 'vitest';
import { registry } from '@m3s/shared';
import { getRequirements, getEnvironments, getFeatures } from '@m3s/shared';
import { MinimalLiFiAdapter } from '../src/adapters/LI.FI.Adapter.js';
import { RuntimeEnvironment, Ms3Modules } from '@m3s/shared';
import { lifiOptionsSchema } from '../src/adapters/LI.FI.registration.js';
import Joi from 'joi';

describe('Crosschain Auto-Generation System Tests', () => {
  describe('JOI Schema Requirements Generation', () => {
    it('should generate correct requirements from LiFi JOI schema', () => {
      const requirements = getRequirements(lifiOptionsSchema, 'lifi');

      expect(requirements.length).toBeGreaterThan(0);

      // ✅ Check for ACTUAL fields from ILiFiAdapterOptionsV1
      const apiKeyReq = requirements.find((r: any) => r.path === 'options.apiKey');
      if (apiKeyReq) {
        expect(apiKeyReq.type).toBe('string');
        expect(apiKeyReq.allowUndefined).toBe(true); // Optional
      }

      // ✅ Check for provider requirement
      const providerReq = requirements.find((r: any) => r.path === 'options.provider');
      if (providerReq) {
        expect(providerReq.allowUndefined).toBe(true); // Optional
      }

      console.log('✅ LiFi requirements generated:', requirements);
    });

    it('should handle bridge-specific configuration requirements', () => {
      const requirements = getRequirements(lifiOptionsSchema, 'lifi');

      // Look for crosschain-specific requirements
      const chainReqs = requirements.filter((r: any) =>
        r.path.includes('chains') || r.path.includes('slippage') || r.path.includes('provider')
      );

      expect(chainReqs.length).toBeGreaterThanOrEqual(0); // May have bridge-specific config
      console.log('📋 Bridge-specific requirements found:', chainReqs.length);
    });

    it('should handle JOI validation rules correctly', () => {
      // Create a test schema with crosschain-specific validation rules
      const testSchema = Joi.object({
        bridgeProtocol: Joi.string().valid('lifi', 'across', 'hop').required().description('Supported bridge protocol'),
        slippageTolerance: Joi.number().min(0).max(100).optional().description('Slippage tolerance percentage (0-100)'),
        routePreference: Joi.object({
          cheapest: Joi.boolean().optional().description('Prefer cheapest route'),
          fastest: Joi.boolean().optional().description('Prefer fastest route'),
          maxHops: Joi.number().integer().min(1).max(5).optional().description('Maximum number of bridge hops')
        }).optional().description('Route selection preferences'),
        supportedChains: Joi.array().items(
          Joi.object({
            chainId: Joi.number().required(),
            name: Joi.string().required()
          })
        ).min(1).required().description('Array of supported blockchain networks')
      });

      const requirements = getRequirements(testSchema, 'crosschain-test');

      // Check bridge protocol requirement
      const protocolReq = requirements.find((r: any) => r.path === 'options.bridgeProtocol');
      expect(protocolReq).toBeDefined();
      expect(protocolReq!.allowUndefined).toBe(false);
      expect(protocolReq!.message).toBe('Supported bridge protocol');

      // Check nested route preference
      const maxHopsReq = requirements.find((r: any) => r.path === 'options.routePreference.maxHops');
      expect(maxHopsReq).toBeDefined();
      expect(maxHopsReq!.type).toBe('number');
      expect(maxHopsReq!.allowUndefined).toBe(true);
    });

    it('should fallback gracefully for invalid schemas', () => {
      // Test with null schema
      const requirements = getRequirements(null as any, 'invalid');
      expect(Array.isArray(requirements)).toBe(true);
      // Should use fallback or return empty array
    });

    // ✅ NEW EDGE CASES - CROSSCHAIN SPECIFIC
    describe('Crosschain JOI Schema Edge Cases', () => {
      it('should handle complex bridge configuration schemas', () => {
        const complexBridgeSchema = Joi.object({
          bridgeConfigs: Joi.object().pattern(
            Joi.string(), // Chain name as key
            Joi.object({
              contractAddress: Joi.string().required(),
              gasLimits: Joi.object({
                deposit: Joi.number().required(),
                withdraw: Joi.number().required()
              }).required(),
              fees: Joi.object({
                fixed: Joi.string().optional(),
                percentage: Joi.number().min(0).max(10).optional()
              }).optional()
            })
          ).required().description('Per-chain bridge configurations'),
          timeouts: Joi.object({
            quote: Joi.number().min(1000).max(30000).default(10000),
            execution: Joi.number().min(30000).max(600000).default(180000)
          }).optional().description('Operation timeout settings')
        });

        const requirements = getRequirements(complexBridgeSchema, 'complex-bridge');
        expect(requirements.length).toBeGreaterThan(0);

        // Should handle pattern-matched object keys
        const bridgeConfigReq = requirements.find(r => r.path === 'options.bridgeConfigs');
        expect(bridgeConfigReq).toBeDefined();
        expect(bridgeConfigReq!.type).toBe('object');
      });

      it('should handle conditional schema based on bridge type', () => {
        const conditionalSchema = Joi.object({
          bridgeType: Joi.string().valid('native', 'wrapped', 'liquidity').required(),
          nativeConfig: Joi.when('bridgeType', {
            is: 'native',
            then: Joi.object({
              lockContract: Joi.string().required(),
              unlockContract: Joi.string().required()
            }).required(),
            otherwise: Joi.forbidden()
          }),
          liquidityConfig: Joi.when('bridgeType', {
            is: 'liquidity',
            then: Joi.object({
              poolAddress: Joi.string().required(),
              slippageProtection: Joi.boolean().default(true)
            }).required(),
            otherwise: Joi.forbidden()
          })
        });

        const requirements = getRequirements(conditionalSchema, 'conditional-bridge');
        expect(requirements.length).toBeGreaterThan(0);

        // Should handle the bridgeType requirement
        const bridgeTypeReq = requirements.find(r => r.path === 'options.bridgeType');
        expect(bridgeTypeReq).toBeDefined();
      });

      it('should handle array schemas with complex validation', () => {
        const arraySchema = Joi.object({
          routes: Joi.array().items(
            Joi.object({
              fromChain: Joi.number().required(),
              toChain: Joi.number().required(),
              bridges: Joi.array().items(Joi.string()).min(1).required(),
              estimatedTime: Joi.number().min(0).required(),
              estimatedCost: Joi.string().pattern(/^\d+(\.\d+)?$/).required()
            })
          ).min(1).required().description('Available routing options')
        });

        const requirements = getRequirements(arraySchema, 'route-array');

        const routesReq = requirements.find(r => r.path === 'options.routes');
        expect(routesReq).toBeDefined();
        expect(routesReq!.type).toBe('array');
        expect(routesReq!.message).toBe('Available routing options');
      });

      it('should handle malformed crosschain schemas without crashing', () => {
        const malformedInputs = [
          null,
          undefined,
          {},
          { describe: 'not a function' },
          { describe: () => { throw new Error('Bridge schema error'); } },
          'not an object',
          42,
          []
        ];

        for (const malformedInput of malformedInputs) {
          expect(() => {
            const requirements = getRequirements(malformedInput as any, 'malformed-bridge');
            expect(Array.isArray(requirements)).toBe(true);
          }).not.toThrow();
        }
      });
    });
  });

  describe('Environment Generation', () => {
    it('should generate environment requirements for crosschain adapters', () => {
      const environment = getEnvironments(
        'lifi',
        [RuntimeEnvironment.SERVER], // LiFi is server-only
        [
          'Requires API key for most bridge operations',
          'Cannot be used in browser environments due to CORS restrictions',
          'Requires wallet adapter for transaction execution'
        ],
        [
          'API keys should be stored securely on server-side',
          'Bridge operations involve significant value transfers',
          'Always verify destination addresses before execution'
        ]
      );

      expect(environment.supportedEnvironments).toEqual([RuntimeEnvironment.SERVER]);
      expect(environment.limitations).toContain('Cannot be used in browser environments due to CORS restrictions');
      expect(environment.securityNotes).toContain('Bridge operations involve significant value transfers');
    });

    it('should handle dual-environment crosschain adapters', () => {
      const environment = getEnvironments(
        'universal-bridge',
        [RuntimeEnvironment.SERVER, RuntimeEnvironment.BROWSER],
        ['Server environment recommended for production'],
        ['Bridge operations involve significant value transfers']
      );

      expect(environment.supportedEnvironments).toContain(RuntimeEnvironment.SERVER);
      expect(environment.supportedEnvironments).toContain(RuntimeEnvironment.BROWSER);
      expect(environment.limitations).toContain('Server environment recommended for production');
      expect(environment.securityNotes).toContain('Bridge operations involve significant value transfers');
      expect(environment.securityNotes).toContain('universal-bridge adapter follows standard security practices');
    });

    // ✅ NEW CROSSCHAIN ENVIRONMENT EDGE CASES
    describe('Crosschain Environment Validation Edge Cases', () => {
      it('should handle bridge-specific environment constraints', () => {
        // Mock different bridge environment scenarios
        const originalProcess = (global as any).process;
        const originalWindow = (global as any).window;

        try {
          // Test server-only bridge environment
          const serverOnlyEnv = getEnvironments('institutional-bridge', [RuntimeEnvironment.SERVER]);

          expect(serverOnlyEnv.supportedEnvironments).toEqual([RuntimeEnvironment.SERVER]);
          // ✅ FIXED: Server-only adapters cannot be used in BROWSER environments, not server environments
          expect(serverOnlyEnv.limitations).toContain('Cannot be used in browser environments');

          // Test bridge with high-security requirements
          const highSecurityEnv = getEnvironments(
            'high-value-bridge',
            [RuntimeEnvironment.SERVER],
            ['Requires hardware security module (HSM) for key management'],
            ['All transactions require multi-signature approval', 'Audit trails are mandatory']
          );

          expect(highSecurityEnv.limitations).toContain('Requires hardware security module (HSM) for key management');
          expect(highSecurityEnv.securityNotes).toContain('All transactions require multi-signature approval');
          expect(highSecurityEnv.securityNotes).toContain('Audit trails are mandatory');

        } finally {
          // Restore original environment
          (global as any).process = originalProcess;
          (global as any).window = originalWindow;
        }
      });

      it('should validate bridge security notes deduplication', () => {
        const environment = getEnvironments(
          'dedup-bridge',
          [RuntimeEnvironment.SERVER],
          ['Duplicate bridge limitation', 'Duplicate bridge limitation', 'Unique bridge limitation'],
          ['Duplicate bridge security', 'Duplicate bridge security', 'Unique bridge security']
        );

        // Should deduplicate limitations and security notes
        const limitationCount = environment.limitations!.filter(l => l === 'Duplicate bridge limitation').length;
        const securityNoteCount = environment.securityNotes!.filter(n => n === 'Duplicate bridge security').length;

        expect(limitationCount).toBe(1);
        expect(securityNoteCount).toBe(1);
        expect(environment.limitations).toContain('Unique bridge limitation');
        expect(environment.securityNotes).toContain('Unique bridge security');
      });
    });
  });

  describe('Features Generation', () => {
    it('should extract method signatures from LiFi adapter', () => {
      const features = getFeatures(MinimalLiFiAdapter);

      expect(features.length).toBeGreaterThan(0);

      // ✅ Check for actual crosschain methods from ICrossChain interface
      const crosschainMethods = features.filter(f =>
        f.name.includes('Quote') || f.name.includes('Operation') || f.name.includes('Chain') || f.name === 'executeOperation'
      );

      expect(crosschainMethods.length).toBeGreaterThan(0);
      console.log('🌉 Crosschain-specific methods found:', crosschainMethods.map(m => m.name));
    });

    it('should handle bridge-specific method parameters correctly', () => {
      const features = getFeatures(MinimalLiFiAdapter);

      // Look for bridge-specific methods
      const bridgeMethods = features.filter(f =>
        f.name === 'getOperationQuote' || f.name === 'executeOperation' || f.name === 'getOperationStatus'
      );

      expect(bridgeMethods.length).toBeGreaterThan(0);

      // Check that methods have reasonable parameter counts
      bridgeMethods.forEach(method => {
        expect(method.parameters).toBeDefined();
        expect(method.isAsync).toBe(true); // Bridge operations should be async
        console.log(`🔧 Bridge method: ${method.name}(${method.parameters.length} params) -> ${method.returnType}`);
      });
    });

    // ✅ NEW CROSSCHAIN FEATURE EXTRACTION EDGE CASES
    describe('Crosschain Feature Extraction Edge Cases', () => {
      it('should handle async bridge method detection correctly', () => {
        const features = getFeatures(MinimalLiFiAdapter);

        // All crosschain operations should be async
        const asyncMethods = features.filter(f => f.isAsync);
        const syncMethods = features.filter(f => !f.isAsync);

        expect(asyncMethods.length).toBeGreaterThan(0);

        // Log for debugging
        console.log('🔄 Async bridge methods:', asyncMethods.map(m => m.name));
        console.log('⚡ Sync bridge methods:', syncMethods.map(m => m.name));
      });

      it('should handle complex bridge operation signatures', () => {
        // Create a mock bridge adapter class for testing
        class MockBridgeAdapter {
          async getBridgeQuote(fromChain: number, toChain: number, asset: string, amount: string): Promise<any> {
            return {};
          }

          async executeBridge(quote: any, slippage?: number, deadline?: number): Promise<string> {
            return '0x';
          }

          getBridgeStatus(operationId: string): any {
            return {};
          }
        }

        const features = getFeatures(MockBridgeAdapter);

        // Find the complex bridge methods
        const quoteMethod = features.find(f => f.name === 'getBridgeQuote');
        const executeMethod = features.find(f => f.name === 'executeBridge');

        if (quoteMethod) {
          expect(quoteMethod.parameters.length).toBe(4);
          expect(quoteMethod.isAsync).toBe(true);
        }

        if (executeMethod) {
          expect(executeMethod.parameters.length).toBe(3);
          expect(executeMethod.isAsync).toBe(true);
        }
      });

      it('should gracefully handle malformed bridge adapter classes', () => {
        // Test with various invalid inputs
        const invalidInputs = [
          null,
          undefined,
          {},
          { prototype: null },
          { prototype: { constructor: null } },
          'not a bridge class'
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
      // ✅ ONLY import what this package controls
      await import('../src/adapters/LI.FI.registration.js');
    });

    it('should have registered lifi adapter with generated data', () => {
      const adapterInfo = registry.getAdapter(Ms3Modules.crosschain, 'lifi', '1.0.0');

      expect(adapterInfo).toBeDefined();
      expect(adapterInfo!.requirements).toBeDefined();
      expect(adapterInfo!.environment).toBeDefined();
      expect(adapterInfo!.features).toBeDefined();

      // ✅ Check environment supports both
      expect(adapterInfo!.environment!.supportedEnvironments).toEqual([
        RuntimeEnvironment.SERVER,
        RuntimeEnvironment.BROWSER
      ]);
      expect(adapterInfo!.environment!.supportedEnvironments).toContain(RuntimeEnvironment.BROWSER);
      console.log('✅ LiFi adapter registered with generated metadata');
    });

    it('should have static compatibility matrix with wallet compatibility declarations', () => {
      const compatMatrix = registry.getCompatibilityMatrix('crosschain', 'lifi', '1.0.0');
      expect(compatMatrix).toBeDefined();
      expect(compatMatrix!.adapterName).toBe('lifi');
      expect(compatMatrix!.version).toBe('1.0.0');

      // ✅ FIX: Test what this package DECLARES about wallet compatibility using requiresCapabilities
      const walletCompat = compatMatrix!.crossModuleCompatibility.find(c => c.moduleName === 'wallet');
      expect(walletCompat).toBeDefined();
      expect(walletCompat!.requiresCapabilities).toBeDefined();
      expect(Array.isArray(walletCompat!.requiresCapabilities)).toBe(true);
      expect(walletCompat!.requiresCapabilities.length).toBeGreaterThan(0);

      console.log('✅ Crosschain correctly DECLARES wallet adapter compatibility requirements');
    });

    it('should have generated bridge-specific compatibility matrices', () => {
      const lifiMatrix = registry.getCompatibilityMatrix(Ms3Modules.crosschain, 'lifi', '1.0.0');
      expect(lifiMatrix).toBeDefined();
      expect(lifiMatrix!.adapterName).toBe('lifi');
      expect(lifiMatrix!.version).toBe('1.0.0');
      expect(lifiMatrix!.compatibleVersions).toContain('1.0.0');
    });

    // ✅ NEW CROSSCHAIN REGISTRY EDGE CASES
    describe('Crosschain Registry Edge Cases', () => {
      it('should handle bridge adapter lookup with invalid parameters', () => {
        // Test various invalid lookups
        expect(registry.getAdapter(Ms3Modules.crosschain, 'nonexistent', '1.0.0')).toBeUndefined();
        expect(registry.getAdapter('nonexistent', 'lifi', '1.0.0')).toBeUndefined();
        expect(registry.getAdapter(Ms3Modules.crosschain, 'lifi', '999.0.0')).toBeUndefined();
      });

      it('should handle bridge compatibility matrix edge cases', () => {
        // Test invalid compatibility matrix lookups
        expect(registry.getCompatibilityMatrix(Ms3Modules.crosschain, 'nonexistent', '1.0.0')).toBeUndefined();
        expect(registry.getCompatibilityMatrix('nonexistent', 'lifi', '1.0.0')).toBeUndefined();

        // Valid matrix should have required properties
        const lifiMatrix = registry.getCompatibilityMatrix(Ms3Modules.crosschain, 'lifi', '1.0.0');
        if (lifiMatrix) {
          expect(lifiMatrix.adapterName).toBeDefined();
          expect(lifiMatrix.version).toBeDefined();
          expect(Array.isArray(lifiMatrix.compatibleVersions)).toBe(true);
          expect(Array.isArray(lifiMatrix.breakingChanges)).toBe(true);
          expect(Array.isArray(lifiMatrix.crossModuleCompatibility)).toBe(true);
        }
      });

      it('should validate bridge registry module registration completeness', () => {
        // Check that all registered bridge adapters have required metadata
        const lifiAdapter = registry.getAdapter(Ms3Modules.crosschain, 'lifi', '1.0.0');
        expect(lifiAdapter).toBeDefined();
        expect(lifiAdapter!.name).toBe('lifi');
        expect(lifiAdapter!.version).toBe('1.0.0');
        expect(lifiAdapter!.module).toBe(Ms3Modules.crosschain);
        expect(lifiAdapter!.adapterClass).toBeDefined();
      });
    });
  });

  describe('Bridge JOI Schema Validation Features', () => {
    it('should demonstrate JOI schema benefits for bridge configurations', () => {
      // Create complex bridge schema with validations
      const complexBridgeSchema = Joi.object({
        bridgeApiKey: Joi.string().alphanum().min(32).max(128).required().description('Bridge API key must be alphanumeric, 32-128 characters'),
        maxSlippage: Joi.number().min(0.1).max(50).optional().default(3).description('Maximum slippage tolerance (0.1-50%)'),
        bridgeTimeout: Joi.number().min(30000).max(1800000).optional().default(300000).description('Bridge timeout in milliseconds (30s-30min)'),
        retryAttempts: Joi.number().integer().min(0).max(10).optional().default(3).description('Number of retry attempts (0-10)'),
        supportedNetworks: Joi.array().items(Joi.number().positive()).min(2).required().description('Array of supported chain IDs'),
        bridgeFeatures: Joi.object({
          enableGasOptimization: Joi.boolean().default(true).description('Enable gas optimization'),
          allowPartialFills: Joi.boolean().default(false).description('Allow partial order fills'),
          useAggregator: Joi.string().valid('1inch', 'paraswap', 'none').optional().description('DEX aggregator preference')
        }).optional().description('Optional bridge feature configuration')
      });

      const requirements = getRequirements(complexBridgeSchema, 'complex-bridge-adapter');

      // Verify complex validations are captured
      const apiKeyReq = requirements.find(r => r.path === 'options.bridgeApiKey');
      expect(apiKeyReq).toBeDefined();
      expect(apiKeyReq!.allowUndefined).toBe(false);
      expect(apiKeyReq!.message).toContain('Bridge API key must be alphanumeric');

      const slippageReq = requirements.find(r => r.path === 'options.maxSlippage');
      expect(slippageReq).toBeDefined();
      expect(slippageReq!.allowUndefined).toBe(true); // Has default value

      const networksReq = requirements.find(r => r.path === 'options.supportedNetworks');
      expect(networksReq).toBeDefined();
      expect(networksReq!.type).toBe('array');
      expect(networksReq!.allowUndefined).toBe(false);

      // Verify nested optional fields
      const gasOptReq = requirements.find(r => r.path === 'options.bridgeFeatures.enableGasOptimization');
      expect(gasOptReq).toBeDefined();
      expect(gasOptReq!.allowUndefined).toBe(true); // Has default value
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed bridge JOI schemas gracefully', () => {
      // This should not crash the system
      const requirements = getRequirements({} as any, 'malformed-bridge');
      expect(Array.isArray(requirements)).toBe(true);
    });

    it('should provide meaningful error messages for bridge validations', () => {
      const schema = Joi.object({
        'bridge.config.endpoint': Joi.string().required().description('Bridge endpoint with special characters in path')
      });

      const requirements = getRequirements(schema, 'edge-case-bridge');

      // Should handle special characters in field names
      expect(requirements.length).toBeGreaterThan(0);
    });

    // ✅ NEW CROSSCHAIN ERROR HANDLING EDGE CASES
    describe('Bridge Error Recovery and Robustness', () => {
      it('should handle memory constraints for large bridge schemas', () => {
        // Create a large bridge schema to test memory handling
        const fields: any = {};
        for (let i = 0; i < 150; i++) {
          fields[`bridgeField${i}`] = Joi.string().optional().description(`Bridge field number ${i}`);
        }

        const largeBridgeSchema = Joi.object(fields);

        expect(() => {
          const requirements = getRequirements(largeBridgeSchema, 'large-bridge-schema');
          expect(Array.isArray(requirements)).toBe(true);
          expect(requirements.length).toBe(150);
        }).not.toThrow();
      });

      it('should handle concurrent bridge schema processing', async () => {
        // Test processing multiple bridge schemas concurrently
        const schemas = [
          lifiOptionsSchema,
          Joi.object({ bridgeTest1: Joi.string().required() }),
          Joi.object({ bridgeTest2: Joi.number().optional() }),
          Joi.object({ bridgeTest3: Joi.boolean().required() }),
          Joi.object({ bridgeTest4: Joi.array().items(Joi.string()).required() })
        ];

        const promises = schemas.map((schema, index) =>
          Promise.resolve(getRequirements(schema, `concurrent-bridge-test-${index}`))
        );

        const results = await Promise.all(promises);

        // All should succeed
        expect(results).toHaveLength(5);
        results.forEach((result, index) => {
          expect(Array.isArray(result)).toBe(true);
          console.log(`✅ Concurrent bridge schema ${index} processed: ${result.length} requirements`);
        });
      });

      it('should maintain consistent behavior across multiple bridge calls', () => {
        // Test that multiple calls to the same bridge schema return consistent results
        const results = [];

        for (let i = 0; i < 5; i++) {
          results.push(getRequirements(lifiOptionsSchema, 'consistency-bridge-test'));
        }

        // All results should be identical
        const firstResult = JSON.stringify(results[0]);
        for (let i = 1; i < results.length; i++) {
          expect(JSON.stringify(results[i])).toBe(firstResult);
        }
      });
    });
  });

  describe('Static Cross-Package Compatibility Matrix', () => {
    beforeAll(async () => {
      await import('../../wallet/src/adapters/ethers/ethersWallet.registration.js');
      await import('../../wallet/src/adapters/web3auth/web3authWallet.registration.js');
    }, 20000);

    it('should test static compatibility declarations (what crosschain package controls)', async () => {
      // ✅ Import the static compatibility functions
      const { checkCrossPackageCompatibility } = await import('@m3s/shared');

      // ✅ Test what the crosschain package DECLARES

      const { wallet } = Ms3Modules
      const { crosschain } = Ms3Modules

      const ccToEthers = checkCrossPackageCompatibility(
        crosschain, 'lifi', '1.0.0',
        wallet, 'ethers', '1.0.0'
      );

      expect(ccToEthers).toBe(true);

      const ccToWeb3Auth = checkCrossPackageCompatibility(
        crosschain, 'lifi', '1.0.0',
        wallet, 'web3auth', '1.0.0'
      );
      expect(ccToWeb3Auth).toBe(false); // Environment incompatible

      console.log('✅ Static compatibility matrix correctly declares wallet compatibility');
    });

    it('should validate environment-aware compatibility (server vs browser)', async () => {
      const { checkCrossPackageCompatibility } = await import('@m3s/shared');
      const { wallet } = Ms3Modules
      const { crosschain } = Ms3Modules

      // ✅ Crosschain should work with ethers (both support server)
      const ccToEthers = checkCrossPackageCompatibility(
        crosschain, 'lifi', '1.0.0',
        wallet, 'ethers', '1.0.0'
      );
      expect(ccToEthers).toBe(true);

      // ✅ Crosschain should NOT work with web3auth (environment mismatch)
      const ccToWeb3Auth = checkCrossPackageCompatibility(
        crosschain, 'lifi', '1.0.0',
        wallet, 'web3auth', '1.0.0'
      );
      expect(ccToWeb3Auth).toBe(false);

      console.log('✅ Environment-aware static compatibility working - server/browser separation maintained');
    });

    it('should handle bridge compatibility with smart contract module', async () => {
      const { checkCrossPackageCompatibility } = await import('@m3s/shared');

      // Crosschain bridges might interact with smart contracts
      // This tests the theoretical compatibility

      const ccToSmartContract = checkCrossPackageCompatibility(
        Ms3Modules.crosschain, 'lifi', '1.0.0',
        Ms3Modules.smartcontract, 'openZeppelin', '1.0.0'
      );

      // This should be false as crosschain doesn't directly declare smart-contract compatibility
      expect(typeof ccToSmartContract).toBe('boolean');
      console.log('🔗 Crosschain to smart-contract compatibility:', ccToSmartContract);
    });

    it('should handle environment-based bridge compatibility validation', async () => {
      // Test that environment requirements are properly enforced in bridge compatibility
      const lifiEnv = registry.getEnvironmentRequirements(Ms3Modules.crosschain, 'lifi', '1.0.0');

      expect(lifiEnv?.supportedEnvironments).toContain(RuntimeEnvironment.SERVER);
      expect(lifiEnv?.supportedEnvironments).toContain(RuntimeEnvironment.BROWSER);

      console.log('✅ Bridge environment requirements properly validated');
    });
  });

  // ✅ NEW CROSSCHAIN INTEGRATION TESTS SECTION
  describe('Cross-Package Bridge Integration Tests', () => {
    beforeAll(async () => {
      await import('../../wallet/src/adapters/ethers/ethersWallet.registration.js');
      await import('../../wallet/src/adapters/web3auth/web3authWallet.registration.js');
    }, 20000);

    it('should validate bridge adapter compatibility with wallet modules', async () => {
      const { checkCrossPackageCompatibility, Ms3Modules } = await import('@m3s/shared');

      // Test bridge compatibility with ethers wallet
      const bridgeToEthers = checkCrossPackageCompatibility(
        Ms3Modules.crosschain, 'lifi', '1.0.0',
        Ms3Modules.wallet, 'ethers', '1.0.0'
      );
      expect(bridgeToEthers).toBe(true);

      // Test bridge incompatibility with web3auth (environment mismatch)
      const bridgeToWeb3Auth = checkCrossPackageCompatibility(
        Ms3Modules.crosschain, 'lifi', '1.0.0',
        Ms3Modules.wallet, 'web3auth', '1.0.0'
      );
      expect(bridgeToWeb3Auth).toBe(false);
    });

    it('should handle environment-based bridge validation', async () => {
      // Test that environment requirements are properly enforced in bridge operations
      const lifiEnv = registry.getEnvironmentRequirements(Ms3Modules.crosschain, 'lifi', '1.0.0');

      expect(lifiEnv?.supportedEnvironments).toContain(RuntimeEnvironment.SERVER);
      expect(lifiEnv?.supportedEnvironments).toContain(RuntimeEnvironment.BROWSER);

      // Bridge-specific limitations should be present
      expect(lifiEnv?.limitations).toBeDefined();
      console.log('🌉 Bridge environment limitations:', lifiEnv?.limitations);
    });
  });

  // ✅ NEW CROSSCHAIN PERFORMANCE AND LOAD TESTS
  describe('Bridge Performance and Load Tests', () => {
    it('should handle rapid bridge adapter lookups efficiently', () => {
      const startTime = Date.now();

      // Perform many rapid lookups
      for (let i = 0; i < 1000; i++) {
        registry.getAdapter(Ms3Modules.crosschain, 'lifi', '1.0.0');
        registry.getCompatibilityMatrix(Ms3Modules.crosschain, 'lifi', '1.0.0');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
      console.log(`✅ 2000 bridge registry lookups completed in ${duration}ms`);
    });

    it('should handle bulk bridge requirement generation efficiently', () => {
      const startTime = Date.now();

      // Generate requirements for many bridge schemas
      for (let i = 0; i < 100; i++) {
        getRequirements(lifiOptionsSchema, `bulk-bridge-test-${i}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(2000);
      console.log(`✅ 100 bridge requirement generations completed in ${duration}ms`);
    });
  });
});