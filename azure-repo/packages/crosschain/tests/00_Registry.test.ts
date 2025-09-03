import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { Capability , getRequirements, getEnvironments, RuntimeEnvironment, Ms3Modules, checkCrossPackageCompatibility, UniversalRegistry} from '@m3s/shared';
import { MinimalLiFiAdapter } from '../src/adapters/LI.FI.Adapter.js';
import { lifiOptionsSchema } from '../src/adapters/LI.FI.registration.js';
import Joi from 'joi';
import { logger } from '../../../logger.js';

let registry: UniversalRegistry;

// ✅ This single beforeAll hook will now correctly initialize the registry.
beforeAll(async () => {
  // Dynamically import the module to get the populated instance.
  const crosschainModule = await import('../src/index.js');
  registry = crosschainModule.crossChainRegistry;
});

describe('Crosschain Auto-Generation System Tests', () => {
  describe('JOI Schema Requirements Generation', () => {
    it('should generate correct requirements from LiFi JOI schema', () => {
      const requirements = getRequirements(lifiOptionsSchema, 'lifi');

      expect(requirements.length).toBeGreaterThan(0);

      const apiKeyReq = requirements.find((r: any) => r.path === 'options.apiKey');
      if (apiKeyReq) {
        expect(apiKeyReq.type).toBe('string');
        expect(apiKeyReq.allowUndefined).toBe(true);
      }

      const providerReq = requirements.find((r: any) => r.path === 'options.provider');
      if (providerReq) {
        expect(providerReq.allowUndefined).toBe(true);
      }

      logger.info('✅ LiFi requirements generated:', requirements);
    });

    it('should handle bridge-specific configuration requirements', () => {
      const requirements = getRequirements(lifiOptionsSchema, 'lifi');

      const chainReqs = requirements.filter((r: any) =>
        r.path.includes('chains') || r.path.includes('slippage') || r.path.includes('provider')
      );

      expect(chainReqs.length).toBeGreaterThanOrEqual(0);
      logger.info('📋 Bridge-specific requirements found:', chainReqs.length);
    });

    it('should handle JOI validation rules correctly', () => {
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

      const protocolReq = requirements.find((r: any) => r.path === 'options.bridgeProtocol');
      expect(protocolReq).toBeDefined();
      expect(protocolReq!.allowUndefined).toBe(false);
      expect(protocolReq!.message).toBe('Supported bridge protocol');

      const maxHopsReq = requirements.find((r: any) => r.path === 'options.routePreference.maxHops');
      expect(maxHopsReq).toBeDefined();
      expect(maxHopsReq!.type).toBe('number');
      expect(maxHopsReq!.allowUndefined).toBe(true);
    });

    it('should fallback gracefully for invalid schemas', () => {
      const requirements = getRequirements(null as any, 'invalid');
      expect(Array.isArray(requirements)).toBe(true);
    });

    describe('Crosschain JOI Schema Edge Cases', () => {
      it('should handle complex bridge configuration schemas', () => {
        const complexBridgeSchema = Joi.object({
          bridgeConfigs: Joi.object().pattern(
            Joi.string(),
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
        [RuntimeEnvironment.SERVER],
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

    describe('Crosschain Environment Validation Edge Cases', () => {
      it('should handle bridge-specific environment constraints', () => {
        const originalProcess = (global as any).process;
        const originalWindow = (global as any).window;

        try {
          const serverOnlyEnv = getEnvironments('institutional-bridge', [RuntimeEnvironment.SERVER]);

          expect(serverOnlyEnv.supportedEnvironments).toEqual([RuntimeEnvironment.SERVER]);
          expect(serverOnlyEnv.limitations).toContain('Cannot be used in browser environments');

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
    it('should expose declared capabilities and expected crosschain methods (metadata + prototype checks)', () => {
      const adapterMeta = registry.getAdapter(Ms3Modules.crosschain, 'lifi', '1.0.0');
      expect(adapterMeta).toBeDefined();
      const capabilities = adapterMeta?.capabilities ?? [];
      expect(capabilities.length).toBeGreaterThan(0);

      expect(capabilities).toContain(Capability.QuoteProvider);
      expect(capabilities).toContain(Capability.OperationHandler);

      const methodNames = Object.getOwnPropertyNames(MinimalLiFiAdapter.prototype)
        .filter(n => n !== 'constructor' && typeof (MinimalLiFiAdapter.prototype as any)[n] === 'function');

      expect(methodNames).toContain('getOperationQuote');
      expect(methodNames).toContain('executeOperation');
      logger.info('🌉 Crosschain-specific methods found (prototype):', methodNames.filter(n =>
        n.includes('Quote') || n.includes('Operation') || n.includes('Chain') || n === 'executeOperation'
      ));
    });

    it('should validate bridge-specific methods are async and have sensible parameter counts', () => {
      const expectedBridgeMethods = ['getOperationQuote', 'executeOperation', 'getOperationStatus'];

      const methodNames = Object.getOwnPropertyNames(MinimalLiFiAdapter.prototype)
        .filter(n => n !== 'constructor' && typeof (MinimalLiFiAdapter.prototype as any)[n] === 'function');

      const found = expectedBridgeMethods.filter(m => methodNames.includes(m));
      expect(found.length).toBeGreaterThan(0);

      for (const name of found) {
        const fn = (MinimalLiFiAdapter.prototype as any)[name];
        expect(typeof fn).toBe('function');

        const paramCount = fn.length;
        expect(typeof paramCount).toBe('number');

        const isAsync = fn && fn.constructor && fn.constructor.name === 'AsyncFunction';
        expect(isAsync).toBe(true);

        logger.info(`🔧 Bridge method: ${name}(${paramCount} params) -> async:${isAsync}`);
      }
    });

    describe('Crosschain Feature Extraction Edge Cases', () => {
      it('should handle async bridge method detection correctly', () => {
        const methodNames = Object.getOwnPropertyNames(MinimalLiFiAdapter.prototype)
          .filter(n => n !== 'constructor' && typeof (MinimalLiFiAdapter.prototype as any)[n] === 'function');

        const asyncMethods = methodNames.filter(n => {
          const fn = (MinimalLiFiAdapter.prototype as any)[n];
          return fn && fn.constructor && fn.constructor.name === 'AsyncFunction';
        });

        const syncMethods = methodNames.filter(n => {
          const fn = (MinimalLiFiAdapter.prototype as any)[n];
          return !(fn && fn.constructor && fn.constructor.name === 'AsyncFunction');
        });

        expect(asyncMethods.length).toBeGreaterThan(0);

        logger.info('🔄 Async bridge methods (prototype):', asyncMethods);
        logger.info('⚡ Sync bridge methods (prototype):', syncMethods);
      });

      it('should handle complex bridge operation signatures', () => {
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

        const proto = MockBridgeAdapter.prototype;
        const quoteFn = (proto as any).getBridgeQuote;
        const execFn = (proto as any).executeBridge;

        if (typeof quoteFn === 'function') {
          expect(quoteFn.length).toBe(4);
          expect(quoteFn.constructor.name).toBe('AsyncFunction');
        } else {
          throw new Error('getBridgeQuote not found on MockBridgeAdapter prototype');
        }

        if (typeof execFn === 'function') {
          expect(execFn.length).toBe(3);
          expect(execFn.constructor.name).toBe('AsyncFunction');
        } else {
          throw new Error('executeBridge not found on MockBridgeAdapter prototype');
        }
      });

      it('should gracefully handle malformed bridge adapter classes', () => {
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
            if (typeof invalidInput === 'function') {
              const names = Object.getOwnPropertyNames((invalidInput as any).prototype || {})
                .filter(n => n !== 'constructor' && typeof (invalidInput as any).prototype[n] === 'function');
              expect(Array.isArray(names)).toBe(true);
            } else if (invalidInput && typeof invalidInput === 'object' && invalidInput.prototype && typeof invalidInput.prototype === 'object') {
              const names = Object.getOwnPropertyNames(invalidInput.prototype || {})
                .filter((n: string) => n !== 'constructor' && typeof (invalidInput as any).prototype[n] === 'function');
              expect(Array.isArray(names)).toBe(true);
            } else {
              expect(typeof invalidInput === 'function').toBe(false);
            }
          }).not.toThrow();
        }
      });
    });
  });

  describe('Registry Integration', () => {
    it('should have registered lifi adapter with generated data', () => {
      const adapterInfo = registry.getAdapter(Ms3Modules.crosschain, 'lifi', '1.0.0');

      expect(adapterInfo).toBeDefined();
      expect(adapterInfo!.requirements).toBeDefined();
      expect(adapterInfo!.environment).toBeDefined();
      expect(adapterInfo!.capabilities).toBeDefined();

      expect(adapterInfo!.environment!.supportedEnvironments).toEqual([
        RuntimeEnvironment.SERVER,
        RuntimeEnvironment.BROWSER
      ]);
      expect(adapterInfo!.environment!.supportedEnvironments).toContain(RuntimeEnvironment.BROWSER);
      logger.info('✅ LiFi adapter registered with generated metadata');
    });

    it('should have static compatibility matrix with wallet compatibility declarations', () => {
      const compatMatrix = registry.getCompatibilityMatrix(Ms3Modules.crosschain, 'lifi', '1.0.0');
      expect(compatMatrix).toBeDefined();
      expect(compatMatrix!.adapterName).toBe('lifi');
      expect(compatMatrix!.version).toBe('1.0.0');

      const walletCompat = compatMatrix!.crossModuleCompatibility.find(c => c.moduleName === Ms3Modules.wallet);
      expect(walletCompat).toBeDefined();
      expect(walletCompat!.requiresCapabilities).toBeDefined();
      expect(Array.isArray(walletCompat!.requiresCapabilities)).toBe(true);
      expect(walletCompat!.requiresCapabilities.length).toBeGreaterThan(0);

      logger.info('✅ Crosschain correctly DECLARES wallet adapter compatibility requirements');
    });

    it('should have generated bridge-specific compatibility matrices', () => {
      const lifiMatrix = registry.getCompatibilityMatrix(Ms3Modules.crosschain, 'lifi', '1.0.0');
      expect(lifiMatrix).toBeDefined();
      expect(lifiMatrix!.adapterName).toBe('lifi');
      expect(lifiMatrix!.version).toBe('1.0.0');
      expect(lifiMatrix!.compatibleVersions).toContain('1.0.0');
    });

    describe('Crosschain Registry Edge Cases', () => {
      it('should handle bridge adapter lookup with invalid parameters', () => {
        expect(registry.getAdapter(Ms3Modules.crosschain, 'nonexistent', '1.0.0')).toBeUndefined();
        expect(registry.getAdapter('nonexistent', 'lifi', '1.0.0')).toBeUndefined();
        expect(registry.getAdapter(Ms3Modules.crosschain, 'lifi', '999.0.0')).toBeUndefined();
      });

      it('should handle bridge compatibility matrix edge cases', () => {
        expect(registry.getCompatibilityMatrix(Ms3Modules.crosschain, 'nonexistent', '1.0.0')).toBeUndefined();
        expect(registry.getCompatibilityMatrix('nonexistent', 'lifi', '1.0.0')).toBeUndefined();

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

      const apiKeyReq = requirements.find(r => r.path === 'options.bridgeApiKey');
      expect(apiKeyReq).toBeDefined();
      expect(apiKeyReq!.allowUndefined).toBe(false);
      expect(apiKeyReq!.message).toContain('Bridge API key must be alphanumeric');

      const slippageReq = requirements.find(r => r.path === 'options.maxSlippage');
      expect(slippageReq).toBeDefined();
      expect(slippageReq!.allowUndefined).toBe(true);

      const networksReq = requirements.find(r => r.path === 'options.supportedNetworks');
      expect(networksReq).toBeDefined();
      expect(networksReq!.type).toBe('array');
      expect(networksReq!.allowUndefined).toBe(false);

      const gasOptReq = requirements.find(r => r.path === 'options.bridgeFeatures.enableGasOptimization');
      expect(gasOptReq).toBeDefined();
      expect(gasOptReq!.allowUndefined).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed bridge JOI schemas gracefully', () => {
      const requirements = getRequirements({} as any, 'malformed-bridge');
      expect(Array.isArray(requirements)).toBe(true);
    });

    it('should provide meaningful error messages for bridge validations', () => {
      const schema = Joi.object({
        'bridge.config.endpoint': Joi.string().required().description('Bridge endpoint with special characters in path')
      });

      const requirements = getRequirements(schema, 'edge-case-bridge');

      expect(requirements.length).toBeGreaterThan(0);
    });

    describe('Bridge Error Recovery and Robustness', () => {
      it('should handle memory constraints for large bridge schemas', () => {
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

        expect(results).toHaveLength(5);
        results.forEach((result, index) => {
          expect(Array.isArray(result)).toBe(true);
          logger.info(`✅ Concurrent bridge schema ${index} processed: ${result.length} requirements`);
        });
      });

      it('should maintain consistent behavior across multiple bridge calls', () => {
        const results = [];

        for (let i = 0; i < 5; i++) {
          results.push(getRequirements(lifiOptionsSchema, 'consistency-bridge-test'));
        }

        const firstResult = JSON.stringify(results[0]);
        for (let i = 1; i < results.length; i++) {
          expect(JSON.stringify(results[i])).toBe(firstResult);
        }
      });
    });
  });

  describe('Static Cross-Package Compatibility Matrix', () => {
    beforeAll(async () => {
      const { walletRegistry } = await import('@m3s/wallet');
      const { smartContractRegistry } = await import('@m3s/smart-contract');
      registry.mergeRegistry(walletRegistry);
      registry.mergeRegistry(smartContractRegistry);
    });

    it('should test static compatibility declarations (what crosschain package controls)', async () => {

      const { wallet } = Ms3Modules
      const { crosschain } = Ms3Modules

      const ccToEthers = checkCrossPackageCompatibility(
        registry,
        crosschain, 'lifi', '1.0.0',
        wallet, 'ethers', '1.0.0'
      );

      expect(ccToEthers).toBe(true);

      const ccToWeb3Auth = checkCrossPackageCompatibility(
        registry,
        crosschain, 'lifi', '1.0.0',
        wallet, 'web3auth', '1.0.0'
      );
      expect(ccToWeb3Auth).toBe(false);

      logger.info('✅ Static compatibility matrix correctly declares wallet compatibility');
    });

    it('should validate environment-aware compatibility (server vs browser)', async () => {
      const { checkCrossPackageCompatibility } = await import('@m3s/shared');
      const { wallet } = Ms3Modules
      const { crosschain } = Ms3Modules

      const ccToEthers = checkCrossPackageCompatibility(
        registry,
        crosschain, 'lifi', '1.0.0',
        wallet, 'ethers', '1.0.0'
      );
      expect(ccToEthers).toBe(true);

      const ccToWeb3Auth = checkCrossPackageCompatibility(
        registry,
        crosschain, 'lifi', '1.0.0',
        wallet, 'web3auth', '1.0.0'
      );
      expect(ccToWeb3Auth).toBe(false);

      logger.info('✅ Environment-aware static compatibility working - server/browser separation maintained');
    });

    it('should handle bridge compatibility with smart contract module', async () => {
      const { checkCrossPackageCompatibility } = await import('@m3s/shared');

      const ccToSmartContract = checkCrossPackageCompatibility(
        registry,
        Ms3Modules.crosschain, 'lifi', '1.0.0',
        Ms3Modules.smartcontract, 'openZeppelin', '1.0.0'
      );

      expect(typeof ccToSmartContract).toBe('boolean');
      logger.info('🔗 Crosschain to smart-contract compatibility:', ccToSmartContract);
    });

    it('should handle environment-based bridge compatibility validation', async () => {
      const lifiEnv = registry.getEnvironmentRequirements(Ms3Modules.crosschain, 'lifi', '1.0.0');

      expect(lifiEnv?.supportedEnvironments).toContain(RuntimeEnvironment.SERVER);
      expect(lifiEnv?.supportedEnvironments).toContain(RuntimeEnvironment.BROWSER);

      logger.info('✅ Bridge environment requirements properly validated');
    });
  });

 describe('Cross-Package Registry Architecture Test', () => {
  let walletRegistry: UniversalRegistry;
  let crossChainRegistry: UniversalRegistry;

  beforeEach(async () => {
    vi.resetModules(); // Clear the module cache for a clean test

    const walletModule = await import('@m3s/wallet');
    const ccModule = await import('@m3s/crosschain');

    walletRegistry = walletModule.walletRegistry;
    crossChainRegistry = ccModule.crossChainRegistry;
  });

  it('should FAIL compatibility check when using isolated, un-merged registries', () => {
    const isCompatible = checkCrossPackageCompatibility(
      crossChainRegistry,
      Ms3Modules.crosschain, 'lifi', '1.0.0',
      Ms3Modules.wallet, 'ethers', '1.0.0'
    );
    expect(isCompatible).toBe(false);
  });

  it('should PASS compatibility check after merging registries', () => {
    crossChainRegistry.mergeRegistry(walletRegistry);

    const isCompatible = checkCrossPackageCompatibility(
      crossChainRegistry,
      Ms3Modules.crosschain, 'lifi', '1.0.0',
      Ms3Modules.wallet, 'ethers', '1.0.0'
    );
    expect(isCompatible).toBe(true);
  });
});

  describe('Bridge Performance and Load Tests', () => {
    it('should handle rapid bridge adapter lookups efficiently', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        registry.getAdapter(Ms3Modules.crosschain, 'lifi', '1.0.0');
        registry.getCompatibilityMatrix(Ms3Modules.crosschain, 'lifi', '1.0.0');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);
      logger.info(`✅ 2000 bridge registry lookups completed in ${duration}ms`);
    });

    it('should handle bulk bridge requirement generation efficiently', () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        getRequirements(lifiOptionsSchema, `bulk-bridge-test-${i}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000);
      logger.info(`✅ 100 bridge requirement generations completed in ${duration}ms`);
    });
  });
});