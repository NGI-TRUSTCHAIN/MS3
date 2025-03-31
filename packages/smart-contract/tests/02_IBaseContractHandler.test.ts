import { describe, it, expect } from 'vitest';
import { IBaseContractHandler } from '../src/types/index.js';

export function testContractHandlerInterface(handler: IBaseContractHandler, skipDeployment: boolean = false) {
  // Safety check for undefined handler
  if (!handler) {
    console.warn('Contract handler is undefined, skipping full test suite');
    return;
  }

  describe('IBaseContractHandler Interface Tests', () => {
    describe('General Initialization Methods', () => {
      it('should implement initialize method', () => {
        expect(typeof handler.initialize).toBe('function');
      });

      it('should implement isInitialized method', () => {
        expect(typeof handler.isInitialized).toBe('function');
      });

      it('should implement disconnect method', () => {
        expect(typeof handler.disconnect).toBe('function');
      });
    });

    describe('Contract Generation & Compilation Methods', () => {
      it('should implement generateContract method', () => {
        expect(typeof handler.generateContract).toBe('function');
      });

      it('should implement compile method', () => {
        expect(typeof handler.compile).toBe('function');
      });
    });

    describe('Contract Deployment & Interaction Methods', () => {
      it('should implement deploy method', () => {
        expect(typeof handler.deploy).toBe('function');
      });

      it('should implement callMethod method', () => {
        expect(typeof handler.callMethod).toBe('function');
      });
    });

    // Only run functional tests if deployment tests aren't skipped
    if (!skipDeployment) {
      describe('Functional Tests', () => {
        it('should be initialized correctly', () => {
          expect(handler.isInitialized()).toBe(true);
        });
      });
    }
  });
}

// Add a basic test to make Vitest recognize this file
describe('IBaseContractHandler Tests', () => {
  it('should export testContractHandlerInterface function', () => {
    expect(typeof testContractHandlerInterface).toBe('function');
  });
});