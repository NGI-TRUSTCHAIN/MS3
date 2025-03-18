import { expect } from "chai";

/**
 * Pure interface validator - validates that a class implements all methods defined in the provided enums
 * 
 * @param AdapterClass - The adapter class constructor to validate
 * @param requiredMethodEnums - Array of enums containing required method names 
 * @param adapterName - Optional name for better error messages
 */
export function validateInterface(
  AdapterClass: any, 
  requiredMethodEnums: object[], 
  adapterName: string = 'Adapter'
): void {
  // Create a mock instance for prototype inspection
  let instance;
  try {
    instance = new AdapterClass({});
  } catch (e) {
    instance = Object.create(AdapterClass.prototype);
  }
  
  const prototype = instance.constructor.prototype;
  
  // Get all required methods from the enums
  const requiredMethods = requiredMethodEnums.flatMap(enumObj => Object.values(enumObj));
  
  // Validate each required method exists
  requiredMethods.forEach(methodName => {
    expect(prototype).to.have.property(methodName).that.is.a('function',
      `${adapterName} must implement "${methodName}" method`);
  });
}