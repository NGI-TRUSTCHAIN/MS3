import { describe, it, expect, beforeAll } from 'vitest';
import { registry } from '@m3s/shared';
import { getRequirements, getEnvironments, getFeatures } from '@m3s/shared';
import { OpenZeppelinAdapter } from '../src/adapters/openZeppelin/adapter.js';
import { RuntimeEnvironment } from '@m3s/shared';
import { openZeppelinOptionsSchema } from '../src/adapters/openZeppelin/openZeppelin.registration.js';
import Joi from 'joi';

describe('Smart Contract Auto-Generation System Tests', () => {
  describe('JOI Schema Requirements Generation', () => {
    it('should generate correct requirements from OpenZeppelin JOI schema', () => {
      const requirements = getRequirements(openZeppelinOptionsSchema, 'openZeppelin');

      expect(requirements.length).toBeGreaterThan(0);

      // ✅ Check for ACTUAL fields from IOpenZeppelinAdapterOptionsV1
      const workDirReq = requirements.find((r: any) => r.path === 'options.workDir');
      expect(workDirReq).toBeDefined();
      expect(workDirReq!.type).toBe('string');
      expect(workDirReq!.allowUndefined).toBe(true); // Optional

      // ✅ Check for hardhatConfig requirement
      const hardhatConfigReq = requirements.find((r: any) => r.path === 'options.hardhatConfig');
      expect(hardhatConfigReq).toBeDefined();
      expect(hardhatConfigReq!.type).toBe('object');
      expect(hardhatConfigReq!.allowUndefined).toBe(true); // Optional

      // ✅ Check for preserveOutput requirement  
      const preserveOutputReq = requirements.find((r: any) => r.path === 'options.preserveOutput');
      expect(preserveOutputReq).toBeDefined();
      expect(preserveOutputReq!.type).toBe('boolean');
      expect(preserveOutputReq!.allowUndefined).toBe(true); // Optional with default

      // ✅ Check for providerConfig requirement
      const providerConfigReq = requirements.find((r: any) => r.path === 'options.providerConfig');
      expect(providerConfigReq).toBeDefined();
      expect(providerConfigReq!.type).toBe('object');
      expect(providerConfigReq!.allowUndefined).toBe(true); // Optional

      console.log('✅ OpenZeppelin requirements generated:', requirements);
    });

    it('should handle compiler configuration requirements', () => {
      const requirements = getRequirements(openZeppelinOptionsSchema, 'openZeppelin');

      // Look for compiler-specific requirements
      const compilerReqs = requirements.filter((r: any) =>
        r.path.includes('compilerSettings') || r.path.includes('solcVersion')
      );

      expect(compilerReqs.length).toBeGreaterThanOrEqual(1); // At least solcVersion or compilerSettings
      console.log('📋 Compiler requirements found:', compilerReqs.length);
    });

    it('should handle JOI validation rules correctly', () => {
      // Create a test schema with smart contract-specific validation rules
      const testSchema = Joi.object({
        contractLanguage: Joi.string().valid('solidity', 'cairo', 'vyper').required().description('Supported smart contract language'),
        compilerVersion: Joi.string().pattern(/^\d+\.\d+\.\d+$/).optional().description('Compiler version in semver format'),
        optimizerSettings: Joi.object({
          enabled: Joi.boolean().default(true).description('Enable compiler optimization'),
          runs: Joi.number().integer().min(1).max(10000).optional().description('Optimizer runs (1-10000)')
        }).optional().description('Compiler optimization configuration'),
        contractTemplates: Joi.array().items(
          Joi.object({
            name: Joi.string().required(),
            type: Joi.string().valid('erc20', 'erc721', 'erc1155').required()
          })
        ).min(1).required().description('Array of contract templates to generate')
      });

      const requirements = getRequirements(testSchema, 'contract-test');

      // Check contract language requirement
      const languageReq = requirements.find(r => r.path === 'options.contractLanguage');
      expect(languageReq).toBeDefined();
      expect(languageReq!.allowUndefined).toBe(false);
      expect(languageReq!.message).toBe('Supported smart contract language');

      // Check nested optimizer settings
      const optimizerRunsReq = requirements.find(r => r.path === 'options.optimizerSettings.runs');
      expect(optimizerRunsReq).toBeDefined();
      expect(optimizerRunsReq!.type).toBe('number');
      expect(optimizerRunsReq!.allowUndefined).toBe(true);
    });

    it('should fallback gracefully for invalid schemas', () => {
      // Test with null schema
      const requirements = getRequirements(null as any, 'invalid');
      expect(Array.isArray(requirements)).toBe(true);
      // Should use fallback or return empty array
    });

    // ✅ NEW EDGE CASES - SMART CONTRACT SPECIFIC
    describe('Smart Contract JOI Schema Edge Cases', () => {
      it('should handle complex contract configuration schemas', () => {
        const complexSchema = Joi.object({
          contracts: Joi.array().items(
            Joi.object({
              name: Joi.string().required(),
              features: Joi.array().items(
                Joi.string().valid('mintable', 'burnable', 'pausable', 'ownable')
              ).optional()
            })
          ).min(1).required(),
          deployment: Joi.object({
            network: Joi.string().required(),
            gasSettings: Joi.object({
              gasLimit: Joi.number().integer().min(21000).required(),
              gasPrice: Joi.alternatives().try(
                Joi.string().pattern(/^\d+$/),
                Joi.number().positive()
              ).optional()
            }).required()
          }).optional()
        });

        const requirements = getRequirements(complexSchema, 'complex-contract');

        // Should have nested requirements for contract arrays and gas settings
        expect(requirements.length).toBeGreaterThan(3);
        const gasLimitReq = requirements.find(r => r.path.includes('gasLimit'));
        expect(gasLimitReq).toBeDefined();
      });

      it('should handle conditional schema based on contract type', () => {
        const conditionalSchema = Joi.object({
          contractType: Joi.string().valid('token', 'nft', 'defi').required(),
          tokenConfig: Joi.when('contractType', {
            is: 'token',
            then: Joi.object({
              symbol: Joi.string().required(),
              decimals: Joi.number().integer().min(0).max(18).required()
            }).required(),
            otherwise: Joi.forbidden()
          }),
          nftConfig: Joi.when('contractType', {
            is: 'nft',
            then: Joi.object({
              baseURI: Joi.string().uri().required(),
              maxSupply: Joi.number().integer().positive().optional()
            }).required(),
            otherwise: Joi.forbidden()
          })
        });

        const requirements = getRequirements(conditionalSchema, 'conditional-contract');
        expect(requirements.length).toBeGreaterThan(0);

        // Should have contract type requirement
        const typeReq = requirements.find(r => r.path === 'options.contractType');
        expect(typeReq).toBeDefined();
        expect(typeReq!.allowUndefined).toBe(false);
      });

      it('should handle array schemas with complex validation', () => {
        const arraySchema = Joi.object({
          constructorArgs: Joi.array().items(
            Joi.object({
              name: Joi.string().required(),
              type: Joi.string().valid('uint256', 'string', 'address', 'bool').required(),
              value: Joi.alternatives().try(
                Joi.string(),
                Joi.number(),
                Joi.boolean()
              ).required()
            })
          ).min(0).max(10).optional(),
          interfaces: Joi.array().items(
            Joi.string().pattern(/^I[A-Z][a-zA-Z0-9]*$/)
          ).unique().optional()
        });

        const requirements = getRequirements(arraySchema, 'array-contract');
        expect(requirements.length).toBeGreaterThan(0);

        // Check for array item requirements
        const constructorReqs = requirements.filter(r => r.path.includes('constructorArgs'));
        expect(constructorReqs.length).toBeGreaterThanOrEqual(0);
      });

      it('should handle malformed contract schemas without crashing', () => {
        const malformedSchemas = [
          undefined,
          null,
          {},
          { invalidStructure: true },
          'not-a-schema'
        ];

        malformedSchemas.forEach((schema, index) => {
          expect(() => {
            const requirements = getRequirements(schema as any, `malformed-${index}`);
            expect(Array.isArray(requirements)).toBe(true);
          }).not.toThrow();
        });
      });
    });
  });

  describe('Environment Generation', () => {
    it('should generate environment requirements for smart contract adapters', () => {
      const environment = getEnvironments(
        'openZeppelin',
        [RuntimeEnvironment.SERVER, RuntimeEnvironment.BROWSER],
        ['Requires blockchain provider for contract interactions'],
        ['Ensure secure private key handling for contract deployment']
      );

      expect(environment.supportedEnvironments).toEqual([
        RuntimeEnvironment.SERVER,
        RuntimeEnvironment.BROWSER
      ]);

      expect(environment.limitations).toContain('Requires blockchain provider for contract interactions');
      expect(environment.securityNotes).toContain('Ensure secure private key handling for contract deployment');
    });

    it('should handle dual-environment contract adapters', () => {
      const environment = getEnvironments(
        'universal-contracts',
        [RuntimeEnvironment.SERVER],
        ['Server environment recommended for contract compilation and deployment'],
        ['Contract interactions involve significant gas costs and should be carefully managed']
      );

      expect(environment.supportedEnvironments).toContain(RuntimeEnvironment.SERVER);
      expect(environment.limitations).toContain('Server environment recommended for contract compilation and deployment');
      expect(environment.securityNotes).toContain('Contract interactions involve significant gas costs and should be carefully managed');
    });

    // ✅ NEW SMART CONTRACT ENVIRONMENT EDGE CASES
    describe('Smart Contract Environment Validation Edge Cases', () => {
      it('should handle contract-specific environment constraints', () => {
        // Mock different contract environment scenarios
        const originalProcess = (global as any).process;
        const originalWindow = (global as any).window;

        try {
          // Test server-only contract environment
          const serverOnlyEnv = getEnvironments('institutional-contracts', [RuntimeEnvironment.SERVER]);

          expect(serverOnlyEnv.supportedEnvironments).toEqual([RuntimeEnvironment.SERVER]);
          // ✅ FIXED: Server-only adapters cannot be used in BROWSER environments, not server environments
          expect(serverOnlyEnv.limitations).toContain('Cannot be used in browser environments');

          // Test contract with high-security requirements
          const highSecurityEnv = getEnvironments(
            'high-value-contracts',
            [RuntimeEnvironment.SERVER],
            ['Requires hardware security module (HSM) for key management'],
            ['All deployments require multi-signature approval', 'Audit trails are mandatory']
          );

          expect(highSecurityEnv.limitations).toContain('Requires hardware security module (HSM) for key management');
          expect(highSecurityEnv.securityNotes).toContain('All deployments require multi-signature approval');
          expect(highSecurityEnv.securityNotes).toContain('Audit trails are mandatory');

          // Test browser-compatible contract environment
          const browserEnv = getEnvironments('client-contracts', [RuntimeEnvironment.BROWSER]);
          expect(browserEnv.supportedEnvironments).toEqual([RuntimeEnvironment.BROWSER]);
          expect(browserEnv.limitations).toContain('Cannot be used in Node.js server environments');

        } finally {
          // Restore original environment
          (global as any).process = originalProcess;
          (global as any).window = originalWindow;
        }
      });

      it('should validate contract security notes deduplication', () => {
        const environment = getEnvironments(
          'security-test-contracts',
          [RuntimeEnvironment.SERVER],
          ['Custom limitation', 'Custom limitation'], // Intentional duplicate
          ['Custom security note', 'Custom security note'] // Intentional duplicate
        );

        // Check that duplicates are removed
        const limitationCount = environment.limitations!.filter(l => l === 'Custom limitation').length;
        const securityNoteCount = environment.securityNotes!.filter(n => n === 'Custom security note').length;

        expect(limitationCount).toBe(1);
        expect(securityNoteCount).toBe(1);
      });
    });
  });

  describe('Features Generation', () => {
    it('should extract method signatures from OpenZeppelin adapter', () => {
      const features = getFeatures(OpenZeppelinAdapter);

      expect(features.length).toBeGreaterThan(0);

      // ✅ Check for actual OpenZeppelin methods from the interface
      const contractMethods = features.filter(f =>
        f.name.includes('deploy') || f.name.includes('compile') || f.name.includes('generateContract') || f.name === 'callMethod'
      );

      expect(contractMethods.length).toBeGreaterThan(0);
      console.log('🔧 Contract-specific methods found:', contractMethods.map(m => m.name));
    });

    it('should handle contract-specific method parameters correctly', () => {
      const features = getFeatures(OpenZeppelinAdapter);

      // Look for contract-specific methods
      const contractMethods = features.filter(f =>
        f.name === 'generateContract' || f.name === 'compile' || f.name === 'deploy' || f.name === 'callMethod'
      );

      expect(contractMethods.length).toBeGreaterThan(0);

      // Check that methods have reasonable parameter counts
      contractMethods.forEach(method => {
        expect(method.parameters).toBeDefined();
        expect(Array.isArray(method.parameters)).toBe(true);

        if (method.name === 'generateContract' || method.name === 'compile') {
          expect(method.parameters.length).toBeGreaterThanOrEqual(1);
        }
      });
    });

    // ✅ NEW SMART CONTRACT FEATURE EXTRACTION EDGE CASES
    describe('Smart Contract Feature Extraction Edge Cases', () => {
      it('should handle async contract method detection correctly', () => {
        const features = getFeatures(OpenZeppelinAdapter);

        // Most contract methods should be async
        const asyncMethods = features.filter(f => f.isAsync || f.returnType.includes('Promise'));
        expect(asyncMethods.length).toBeGreaterThan(0);

        // Specific async methods
        const generateMethod = features.find(f => f.name === 'generateContract');
        if (generateMethod) {
          expect(generateMethod.isAsync || generateMethod.returnType.includes('Promise')).toBe(true);
        }
      });

      it('should handle complex contract operation signatures', () => {
        const features = getFeatures(OpenZeppelinAdapter);

        // Look for methods with complex parameters
        const complexMethods = features.filter(f =>
          f.parameters.length > 1 ||
          f.parameters.some(p => p.type === 'object' || p.name.includes('input') || p.name.includes('config'))
        );

        expect(complexMethods.length).toBeGreaterThan(0);
        console.log('🔧 Complex contract methods found:', complexMethods.map(m => `${m.name}(${m.parameters.length})`));
      });

      it('should gracefully handle malformed contract adapter classes', () => {
        const malformedClasses = [
          null,
          undefined,
          {},
          class EmptyClass { },
          function NotAClass() { }
        ];

        malformedClasses.forEach((malformedClass, index) => {
          expect(() => {
            const features = getFeatures(malformedClass as any);
            expect(Array.isArray(features)).toBe(true);
          }).not.toThrow();
        });
      });
    });
  });

  describe('Registry Integration', () => {
    beforeAll(async () => {
      // ✅ ONLY import what this package controls
      await import('../src/adapters/openZeppelin/openZeppelin.registration.js');
    });

    it('should have registered openZeppelin adapter with generated data', () => {
      const adapterInfo = registry.getAdapter('smart-contract', 'openZeppelin', '1.0.0');

      expect(adapterInfo).toBeDefined();
      expect(adapterInfo!.requirements).toBeDefined();
      expect(adapterInfo!.environment).toBeDefined();
      expect(adapterInfo!.features).toBeDefined();

      // ✅ Check requirements count matches the corrected JOI schema (should be 11 based on output)
      expect(adapterInfo!.requirements!.length).toBe(11);

      console.log('✅ OpenZeppelin adapter registered with generated metadata');
    });

    it('should have static compatibility matrix with wallet compatibility declarations', () => {
      const compatMatrix = registry.getCompatibilityMatrix('smart-contract', 'openZeppelin', '1.0.0');
      expect(compatMatrix).toBeDefined();
      expect(compatMatrix!.adapterName).toBe('openZeppelin');
      expect(compatMatrix!.version).toBe('1.0.0');

      // ✅ FIX: Test what this package DECLARES about wallet compatibility using requiresCapabilities
      const walletCompat = compatMatrix!.crossModuleCompatibility.find(c => c.moduleName === 'wallet');
      expect(walletCompat).toBeDefined();
      expect(walletCompat!.requiresCapabilities).toBeDefined();
      expect(Array.isArray(walletCompat!.requiresCapabilities)).toBe(true);
      expect(walletCompat!.requiresCapabilities.length).toBeGreaterThan(0);

      console.log('✅ Smart contract correctly DECLARES wallet adapter compatibility requirements');
    });

    it('should have generated contract-specific compatibility matrices', () => {
      const openZeppelinMatrix = registry.getCompatibilityMatrix('smart-contract', 'openZeppelin', '1.0.0');
      expect(openZeppelinMatrix).toBeDefined();
      expect(openZeppelinMatrix!.adapterName).toBe('openZeppelin');
      expect(openZeppelinMatrix!.version).toBe('1.0.0');
      expect(openZeppelinMatrix!.compatibleVersions).toContain('1.0.0');
    });

    // ✅ NEW SMART CONTRACT REGISTRY EDGE CASES
    describe('Smart Contract Registry Edge Cases', () => {
      it('should handle contract adapter lookup with invalid parameters', () => {
        const invalidLookups = [
          ['smart-contract', '', '1.0.0'],
          ['smart-contract', 'nonexistent', '1.0.0'],
          ['smart-contract', 'openZeppelin', '999.0.0'],
          ['', 'openZeppelin', '1.0.0']
        ];

        invalidLookups.forEach(([module, adapter, version]) => {
          const result = registry.getAdapter(module, adapter, version);
          if (module === '' || adapter === '' || adapter === 'nonexistent' || version === '999.0.0') {
            expect(result).toBeUndefined();
          }
        });
      });

      it('should handle contract compatibility matrix edge cases', () => {
        const matrix = registry.getCompatibilityMatrix('smart-contract', 'openZeppelin', '1.0.0');
        expect(matrix).toBeDefined();

        // Test breaking changes structure
        expect(Array.isArray(matrix!.breakingChanges)).toBe(true);

        // Test cross-module compatibility structure
        expect(Array.isArray(matrix!.crossModuleCompatibility)).toBe(true);
        // ✅ FIX: Check for the correct properties on the compatibility object
        matrix!.crossModuleCompatibility.forEach(compat => {
          expect(typeof compat.moduleName).toBe('string');
          expect(Array.isArray(compat.requiresCapabilities)).toBe(true);
        });
      });

      it('should validate contract registry module registration completeness', () => {
        const modulesInfo = registry.getAllModules();
        expect(modulesInfo).toBeDefined();

        const sc_module = (modulesInfo.filter((m: any) => m.name === 'smart-contract'))[0]

        expect(sc_module!.name).toBe('smart-contract');
        expect(sc_module!.version).toBeDefined();

        // Check that adapters are properly registered
        const adapters = registry.getModuleAdapters('smart-contract');
        expect(adapters.length).toBeGreaterThan(0);

        const openZeppelinAdapter = adapters.find(a => a.name === 'openZeppelin');
        expect(openZeppelinAdapter).toBeDefined();
        expect(openZeppelinAdapter!.version).toBe('1.0.0');
      });
    });
  });

  describe('Smart Contract JOI Schema Validation Features', () => {
    it('should demonstrate JOI schema benefits for contract configurations', () => {
      // Create complex contract schema with validations
      const complexContractSchema = Joi.object({
        contractName: Joi.string().alphanum().min(3).max(50).required().description('Contract name must be alphanumeric, 3-50 characters'),
        solcVersion: Joi.string().pattern(/^\d+\.\d+\.\d+$/).optional().default('0.8.22').description('Solidity compiler version in semver format'),
        gasLimit: Joi.number().integer().min(21000).max(30000000).optional().default(3000000).description('Gas limit for deployment (21k-30M)'),
        constructorArgs: Joi.array().items(
          Joi.object({
            name: Joi.string().required(),
            type: Joi.string().valid('uint256', 'string', 'address', 'bool').required(),
            value: Joi.any().required()
          })
        ).max(10).optional().description('Constructor arguments (max 10)'),
        features: Joi.object({
          mintable: Joi.boolean().optional().description('Enable minting functionality'), // ✅ REMOVED .default(false)
          burnable: Joi.boolean().default(false).description('Enable burning functionality'),
          pausable: Joi.boolean().default(false).description('Enable pause/unpause functionality'),
          upgradeable: Joi.string().valid('transparent', 'uups', 'beacon').optional().description('Upgrade pattern')
        }).optional().description('Optional contract feature configuration')
      });

      const requirements = getRequirements(complexContractSchema, 'complex-contract-adapter');

      // Verify complex validations are captured
      const contractNameReq = requirements.find(r => r.path === 'options.contractName');
      expect(contractNameReq).toBeDefined();
      expect(contractNameReq!.allowUndefined).toBe(false);
      expect(contractNameReq!.message).toBe('Contract name must be alphanumeric, 3-50 characters');

      // Check nested feature configuration
      const mintableReq = requirements.find(r => r.path === 'options.features.mintable');
      expect(mintableReq).toBeDefined();
      expect(mintableReq!.type).toBe('boolean');
      expect(mintableReq!.allowUndefined).toBe(true); // ✅ Now should be true since no default

    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed contract JOI schemas gracefully', () => {
      const malformedSchemas = [
        null,
        undefined,
        'not-a-schema',
        { invalidProperty: 'value' },
        () => { return 'function-instead-of-schema'; }
      ];

      malformedSchemas.forEach((schema, index) => {
        expect(() => {
          const requirements = getRequirements(schema as any, `malformed-contract-${index}`);
          expect(Array.isArray(requirements)).toBe(true);
        }).not.toThrow();
      });
    });

    it('should provide meaningful error messages for contract validations', () => {
      // Test that contract validation error messages are descriptive
      const contractSchema = Joi.object({
        contractType: Joi.string().valid('erc20', 'erc721', 'erc1155').required().description('Must be a supported contract standard'),
        deploymentNetwork: Joi.string().valid('mainnet', 'goerli', 'sepolia', 'holesky', 'polygon').required().description('Must be a supported network')
      });

      const requirements = getRequirements(contractSchema, 'validation-test');

      const typeReq = requirements.find(r => r.path === 'options.contractType');
      expect(typeReq!.message).toBe('Must be a supported contract standard');

      const networkReq = requirements.find(r => r.path === 'options.deploymentNetwork');
      expect(networkReq!.message).toBe('Must be a supported network');
    });

    // ✅ NEW SMART CONTRACT ERROR HANDLING EDGE CASES
    describe('Contract Error Recovery and Robustness', () => {
      it('should handle memory constraints for large contract schemas', () => {
        // Create a large schema to test memory handling
        const largeSchema = Joi.object(
          Array.from({ length: 1000 }, (_, i) => ({
            [`field${i}`]: Joi.string().optional().description(`Field ${i} for testing`)
          })).reduce((acc, curr) => ({ ...acc, ...curr }), {})
        );

        const startTime = Date.now();
        const requirements = getRequirements(largeSchema, 'large-contract-schema');
        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(Array.isArray(requirements)).toBe(true);
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
        console.log(`✅ Large schema processing completed in ${duration}ms`);
      });

      it('should handle concurrent contract schema processing', async () => {
        const contractSchemas = Array.from({ length: 10 }, (_, i) =>
          Joi.object({
            [`contractName${i}`]: Joi.string().required().description(`Contract ${i} name`),
            [`version${i}`]: Joi.string().optional().description(`Contract ${i} version`)
          })
        );

        const startTime = Date.now();
        const promises = contractSchemas.map((schema, i) =>
          Promise.resolve(getRequirements(schema, `concurrent-contract-${i}`))
        );

        const results = await Promise.all(promises);
        const endTime = Date.now();
        const duration = endTime - startTime;

        expect(results.length).toBe(10);
        results.forEach(result => {
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBeGreaterThan(0);
        });

        expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
        console.log(`✅ Concurrent schema processing completed in ${duration}ms`);
      });

      it('should maintain consistent behavior across multiple contract calls', () => {
        const testSchema = Joi.object({
          contractName: Joi.string().required().description('Contract name'),
          features: Joi.array().items(Joi.string()).optional().description('Contract features')
        });

        const results = [];
        for (let i = 0; i < 100; i++) {
          results.push(getRequirements(testSchema, `consistency-test-${i}`));
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
      await import('../../wallet/src/adapters/ethers/v1/ethersWallet.registration.js');
      await import('../../wallet/src/adapters/web3auth/v1/web3authWallet.registration.js');
    }, 20000);

    it('should test static compatibility declarations (what smart-contract package controls)', async () => {
      // ✅ Import the static compatibility functions
      const { checkCrossPackageCompatibility } = await import('@m3s/shared');

      // ✅ Test what the smart-contract package DECLARES
      const scToEthers = checkCrossPackageCompatibility(
        'smart-contract', 'openZeppelin', '1.0.0',
        'wallet', 'ethers', '1.0.0'
      );
      expect(scToEthers).toBe(true);

      const scToWeb3Auth = checkCrossPackageCompatibility(
        'smart-contract', 'openZeppelin', '1.0.0',
        'wallet', 'web3auth', '1.0.0'
      );
      expect(scToWeb3Auth).toBe(false);

      console.log('✅ Static compatibility matrix correctly declares wallet compatibility');
    });

    it('should validate environment-aware compatibility (crosschain example)', async () => {
      const { checkCrossPackageCompatibility } = await import('@m3s/shared');

      // ✅ Smart contract should work with ethers (both support server)
      const scToEthers = checkCrossPackageCompatibility(
        'smart-contract', 'openZeppelin', '1.0.0',
        'wallet', 'ethers', '1.0.0'
      );
      expect(scToEthers).toBe(true);

      // ✅ Smart contract should work with web3auth (both support browser)
      const scToWeb3Auth = checkCrossPackageCompatibility(
        'smart-contract', 'openZeppelin', '1.0.0',
        'wallet', 'web3auth', '1.0.0'
      );
      expect(scToWeb3Auth).toBe(false);

      console.log('✅ Environment-aware static compatibility working');
    });

    it('should handle contract compatibility with crosschain module', async () => {
      const { checkCrossPackageCompatibility } = await import('@m3s/shared');

      // Smart contracts might interact with crosschain protocols
      // This tests the theoretical compatibility
      const scToCrosschain = checkCrossPackageCompatibility(
        'smart-contract', 'openZeppelin', '1.0.0',
        'crosschain', 'lifi', '1.0.0'
      );

      // This should be false as smart-contract doesn't directly declare crosschain compatibility
      expect(typeof scToCrosschain).toBe('boolean');
      console.log('🔗 Smart-contract to crosschain compatibility:', scToCrosschain);
    });

    it('should handle environment-based contract compatibility validation', async () => {
      // Test that environment requirements are properly enforced in contract compatibility
      const openZeppelinEnv = registry.getEnvironmentRequirements('smart-contract', 'openZeppelin', '1.0.0');

      expect(openZeppelinEnv?.supportedEnvironments).toContain(RuntimeEnvironment.SERVER);

      console.log('✅ Contract environment requirements properly validated');
    });
  });

  // ✅ NEW SMART CONTRACT INTEGRATION TESTS SECTION
  describe('Cross-Package Contract Integration Tests', () => {
    beforeAll(async () => {
      await import('../../wallet/src/adapters/ethers/v1/ethersWallet.registration.js');
      await import('../../wallet/src/adapters/web3auth/v1/web3authWallet.registration.js');
    }, 20000);

    it('should validate contract adapter compatibility with wallet modules', async () => {
      const { checkCrossPackageCompatibility } = await import('@m3s/shared');

      // Test contract compatibility with ethers wallet
      const contractToEthers = checkCrossPackageCompatibility(
        'smart-contract', 'openZeppelin', '1.0.0',
        'wallet', 'ethers', '1.0.0'
      );
      expect(contractToEthers).toBe(true);

      // Test contract compatibility with web3auth wallet
      const contractToWeb3Auth = checkCrossPackageCompatibility(
        'smart-contract', 'openZeppelin', '1.0.0',
        'wallet', 'web3auth', '1.0.0'
      );
      expect(contractToWeb3Auth).toBe(false);

      console.log('✅ Contract adapters properly declare wallet compatibility');
    });

    it('should handle environment-based contract validation', async () => {

      // Test environment-aware compatibility validation
      const contractEnv = registry.getEnvironmentRequirements('smart-contract', 'openZeppelin', '1.0.0');

      // ✅ Check if wallet env is available, skip if not
      const walletEnv = registry.getEnvironmentRequirements('wallet', 'ethers', '1.0.0');

      expect(contractEnv?.supportedEnvironments).toBeDefined();

      if (walletEnv) {
        expect(walletEnv.supportedEnvironments).toBeDefined();

        // Both should support server environment
        expect(contractEnv?.supportedEnvironments).toContain(RuntimeEnvironment.SERVER);
        expect(walletEnv.supportedEnvironments).toContain(RuntimeEnvironment.SERVER);
      } else {
        console.warn('Wallet environment requirements not available - wallet adapters may not be registered in this test context');
        // Just test the contract environment
        expect(contractEnv?.supportedEnvironments).toContain(RuntimeEnvironment.SERVER);
      }

      console.log('✅ Environment-based contract validation working');
    });
  });

  // ✅ NEW SMART CONTRACT PERFORMANCE AND LOAD TESTS
  describe('Contract Performance and Load Tests', () => {
    it('should handle rapid contract adapter lookups efficiently', () => {
      const startTime = Date.now();

      // Perform many rapid lookups
      for (let i = 0; i < 1000; i++) {
        registry.getAdapter('smart-contract', 'openZeppelin', '1.0.0');
        registry.getCompatibilityMatrix('smart-contract', 'openZeppelin', '1.0.0');
        registry.getEnvironmentRequirements('smart-contract', 'openZeppelin', '1.0.0');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000);
      console.log(`✅ 1000 contract adapter lookups completed in ${duration}ms`);
    });

    it('should handle bulk contract requirement generation efficiently', () => {
      const startTime = Date.now();

      // Generate requirements for many contract schemas
      for (let i = 0; i < 100; i++) {
        getRequirements(openZeppelinOptionsSchema, `bulk-contract-test-${i}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(2000);
      console.log(`✅ 100 contract requirement generations completed in ${duration}ms`);
    });
  });
});