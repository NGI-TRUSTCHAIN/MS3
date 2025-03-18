import { IEVMRequiredMethods, IRequiredMethods, WalletType } from "packages/wallet/src/types";
import { validateInterface } from "tests/utils/validator";

// This test is designed to be called programmatically with dynamic imports
describe("Dynamic Adapter Validation", function() {
  this.timeout(5000);

  // The test will be invoked with these parameters from the validation script
  it("should validate adapter implements required interface", async function() {
    // Dynamically load the adapter class - will be provided by the validation script
    const adapterPath = process.env.ADAPTER_PATH;
    const adapterType = process.env.ADAPTER_TYPE;
    
    if (!adapterPath) {
      throw new Error("ADAPTER_PATH environment variable is required");
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
    
    console.log(`Testing adapter class: ${AdapterClass.name}`);
    
    // Determine which methods are required based on adapter type
    const requiredEnums: any = [IRequiredMethods]; // Core methods always required
    
    // Add type-specific methods
    if (adapterType === WalletType.evm || adapterType === WalletType.web3auth) {
      requiredEnums.push(IEVMRequiredMethods);
    }
    
    // Use the validator utility
    validateInterface(AdapterClass, requiredEnums, AdapterClass.name);
  });
});