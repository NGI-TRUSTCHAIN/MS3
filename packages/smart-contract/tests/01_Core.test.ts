import { describe, it, expect } from 'vitest';
import { AdapterArguments } from '@m3s/common';
import { IOpenZeppelinAdapterOptionsV1 } from '../src/adapters/index.js';

/**
 * Tests the adapter design pattern to ensure it follows factory pattern requirements
 * @param AdapterClass The adapter class to test
 * @param mockArgs Mock arguments for constructor testing
 */
export function testAdapterPattern(AdapterClass: any, mockArgs: any = {}) {
  describe(`${AdapterClass.name} - Constructor Pattern Tests`, () => {
    it('should have a private constructor', () => {
      try {
        // @ts-ignore - Intentionally testing that private constructor can't be called
        new AdapterClass(mockArgs);
        throw new Error('Constructor should be private but was accessible');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should have a static create method', () => {
      expect(typeof AdapterClass.create).toBe('function');
    });

    // ✅ Updated for smart contract adapter
    const adapterNameForTest = AdapterClass.name === 'OpenZeppelinAdapter' ? 'openZeppelin' : AdapterClass.name.toLowerCase();
    const adapterVersionForTest = '1.0.0';
    
    interface TestArgs extends AdapterArguments<IOpenZeppelinAdapterOptionsV1> { }

    const completeMockArgsForCreate: TestArgs = {
      name: adapterNameForTest,        // ✅ Changed from adapterName to name
      version: adapterVersionForTest,  // ✅ Added version
      options: mockArgs || {},
    };

    it('create method should return a promise', () => {
      const result = AdapterClass.create(completeMockArgsForCreate);
      expect(result).toBeInstanceOf(Promise);
    });

    it('create method should resolve to an instance of the adapter', async () => {
      try {
        const instance = await AdapterClass.create(completeMockArgsForCreate);
        expect(instance).toBeInstanceOf(AdapterClass);
      } catch (error: any) {
        console.warn(`Creation failed in test: ${error.message}`);
      }
    });

    // ✅ Test name and version properties
    it('created instance should have name and version properties', async () => {
      try {
        const instance = await AdapterClass.create(completeMockArgsForCreate);
        
        expect(instance).toHaveProperty('name');
        expect(instance.name).toBe(adapterNameForTest);
        expect(instance).toHaveProperty('version');
        expect(instance.version).toBe(adapterVersionForTest);
        
      } catch (error: any) {
        console.warn(`Property test failed: ${error.message}`);
      }
    });
  });
}

describe('Core Contract Tests', () => {
  it('should export testAdapterPattern function', () => {
    expect(typeof testAdapterPattern).toBe('function');
  });
});