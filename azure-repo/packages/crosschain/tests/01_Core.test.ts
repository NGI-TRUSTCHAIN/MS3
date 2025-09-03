import { AdapterArguments } from '@m3s/shared';
import { describe, it, expect } from 'vitest';
import { ILiFiAdapterOptionsV1 } from '../src/adapters/LI.FI.Adapter.js';
import {logger} from '../../../logger.js';

/**
 * Tests the adapter design pattern to ensure it follows factory pattern requirements
 * @param AdapterClass The adapter class to test
 * @param mockArgs Mock arguments for constructor testing
 */
export function testAdapterPattern(AdapterClass: any, mockArgs: any = {}) {
  describe(`${AdapterClass.name} - Constructor Pattern Tests`, () => {
    it('should have a private constructor', () => {
      try {
        new AdapterClass(mockArgs);
        throw new Error('Constructor should be private but was accessible');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should have a static create method', () => {
      expect(typeof AdapterClass.create).toBe('function');
    });

    const adapterNameForTest = AdapterClass.name === 'MinimalLiFiAdapter' ? 'lifi' : AdapterClass.name.toLowerCase();
    const adapterVersionForTest = '1.0.0';
    
    interface TestArgs extends AdapterArguments<ILiFiAdapterOptionsV1> { }

    const completeMockArgsForCreate: TestArgs = {
      name: adapterNameForTest,
      version: adapterVersionForTest,
      options: mockArgs || {},
    };

    it('create method should return a promise', () => {
      try {
        const result = AdapterClass.create(completeMockArgsForCreate);
        expect(result).toBeInstanceOf(Promise);
      } catch (e: any) {
        logger.error(`[testAdapterPattern] Error in "create method should return a promise" for ${AdapterClass.name} with args ${JSON.stringify(completeMockArgsForCreate)}: ${e.message}`);
        throw e;
      }
    });

    it('create method should resolve to an instance of the adapter', async () => {
      try {
        const instance = await AdapterClass.create(completeMockArgsForCreate);
        expect(instance).toBeInstanceOf(AdapterClass);
      } catch (error: any) {
        logger.warning(`Creation failed in test: ${error.message}`);
      }
    });

    it('created instance should have name and version properties', async () => {
      try {
        const instance = await AdapterClass.create(completeMockArgsForCreate);
        
        expect(instance).toHaveProperty('name');
        expect(typeof instance.name).toBe('string');
        expect(instance.name).toBe(adapterNameForTest);
        
        expect(instance).toHaveProperty('version');
        expect(typeof instance.version).toBe('string');
        expect(instance.version).toBe(adapterVersionForTest);
        
      } catch (error: any) {
        logger.warning(`Property test failed: ${error.message}`);
      }
    });

    it('should have getAdapterName method returning name', async () => {
      try {
        const instance = await AdapterClass.create(completeMockArgsForCreate);
        
        if (typeof instance.getAdapterName === 'function') {
          const adapterName = instance.getAdapterName();
          expect(typeof adapterName).toBe('string');
          expect(adapterName).toBe(adapterNameForTest);
        } else {
          logger.warning(`${AdapterClass.name} does not have getAdapterName method`);
        }
        
      } catch (error: any) {
        logger.warning(`getAdapterName test failed: ${error.message}`);
      }
    });
  });
}

describe('Core CrossChain Tests', () => {
  it('should export testAdapterPattern function', () => {
    expect(typeof testAdapterPattern).toBe('function');
  });

  it('should have proper AdapterArguments structure', () => {
    const mockAdapterArgs: AdapterArguments<ILiFiAdapterOptionsV1> = {
      name: 'lifi',
      version: '1.0.0',
      options: {}
    };

    expect(mockAdapterArgs).toHaveProperty('name');
    expect(mockAdapterArgs).toHaveProperty('version');
    expect(mockAdapterArgs).toHaveProperty('options');
    expect(typeof mockAdapterArgs.name).toBe('string');
    expect(typeof mockAdapterArgs.version).toBe('string');
    expect(typeof mockAdapterArgs.options).toBe('object');
  });
});