import { validateInterface } from "../../../utils/validator";

enum IRequiredMethods {
  /** General Initialization */
  initialize = "initialize",
  isInitialized = "isInitialized",
  disconnect = "disconnect",

  /** Wallet Metadata */
  getWalletName = "getWalletName",  
  getWalletVersion = "getWalletVersion",
  isConnected = "isConnected",

  /** Account Management */
  requestAccounts = "requestAccounts",
  getPrivateKey = "getPrivateKey",
  getAccounts = "getAccounts",
  getBalance = "getBalance",
  verifySignature = "verifySignature",
  on = "on",
  off = "off",

  /** Network Management */
  getNetwork = "getNetwork",
  setProvider = "setProvider",

  /** Transactions & Signing */
  sendTransaction = "sendTransaction",
  signTransaction = "signTransaction",
  signMessage = "signMessage",
}

enum IEVMRequiredMethods {
  signTypedData = "signTypedData",
  getGasPrice = "getGasPrice",
  estimateGas = "estimateGas",
  getTransactionReceipt = "getTransactionReceipt",
  getTokenBalance = "getTokenBalance",
  
}

// Map interface names to their required method enums
const interfaceMethodMap: Record<string, any[]> = {
  'ICoreWallet': [IRequiredMethods],
  'IEVMWallet': [IRequiredMethods, IEVMRequiredMethods]
};

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
    
    console.log(`Loading adapter from path: ${adapterPath}`);
    
    // Dynamic import of the adapter module
    const adapterModule = await import(adapterPath);
    
    // Find the adapter class in the module with proper type casting
    const AdapterClass = Object.values(adapterModule).find(
      (exp): exp is new (...args: any[]) => any => 
        typeof exp === 'function' && 
        typeof exp.name === 'string' && 
        exp.name.includes('Wallet')
    );
    
    if (!AdapterClass) {
      throw new Error(`No adapter class found in ${adapterPath}`);
    }
    
    console.log(`Testing adapter class: ${AdapterClass.name} implements ${interfaceName}`);
    
    // Get required methods dynamically from the interface map
    const requiredEnums = interfaceMethodMap[interfaceName] || [IRequiredMethods];
    
    // Use the validator utility
    validateInterface(AdapterClass, requiredEnums, AdapterClass.name);
  });
});