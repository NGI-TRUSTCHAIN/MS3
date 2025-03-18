import { IEVMRequiredMethods, IRequiredMethods } from "packages/wallet/src/types";
import { validateInterface } from "tests/utils/validator";

// This test is designed to be called programmatically with dynamic imports
describe("Dynamic Adapter Validation", function() {
  this.timeout(5000);

  // The test will be invoked with these parameters from the validation script
  it("should validate adapter implements required interface", async function() {
    // Dynamically load the adapter class - will be provided by the validation script
    const adapterPath = process.env.ADAPTER_PATH;
    const interfaceName = process.env.INTERFACE_NAME;
    
    if (!adapterPath || !interfaceName) {
      throw new Error("ADAPTER_PATH and INTERFACE_NAME environment variables are required");
    }
    
    // Dynamic import of the adapter module
    const adapterModule = await import(adapterPath);
    
    // Find the adapter class in the module (usually the default export or named export)
    const AdapterClass: any = Object.values(adapterModule).find(
      exp => typeof exp === 'function' && exp.name.includes('Wallet')
    );
    
    if (!AdapterClass) {
      throw new Error(`No adapter class found in ${adapterPath}`);
    }
    
    console.log(`Testing adapter class: ${AdapterClass.name} implements ${interfaceName}`);
    
    // Determine which methods are required based on interface name
    const requiredEnums: any = [IRequiredMethods]; // Core methods always required
    
    // Add interface-specific methods based on the detected interface
    if (interfaceName === 'EVMWallet') {
      requiredEnums.push(IEVMRequiredMethods);
    }
    // Future interfaces can be added here without modifying the validation script
    
    // Use the validator utility
    validateInterface(AdapterClass, requiredEnums, AdapterClass.name);
  });
});