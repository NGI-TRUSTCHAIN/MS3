import { ethers, Provider, TransactionRequest, TransactionReceipt, Interface } from "ethers";
import { DeployInput, DeployedOutput, CallInput } from '../../../types/index.js'; // Adjust path
import { GenericTransactionData } from "@m3s/common";

export default class EvmInteractor {
    private defaultProvider?: Provider; // Store the default provider instance
    constructor(defaultProvider?: Provider) {
        this.defaultProvider = defaultProvider;
        if (this.defaultProvider) {
            console.log(`[EvmInteractor] Initialized with a default provider.`);
        } else {
            console.log(`[EvmInteractor] Initialized without a default provider (reads without wallet will fail).`);
        }
    }

    async deployContract(input: DeployInput): Promise<DeployedOutput> {
        const { compiledContract, constructorArgs = [], wallet, deployOptions = {} } = input;

        const contractName = compiledContract.metadata?.contractName || compiledContract.artifacts?.contractName || 'UnknownContract';
        console.log(`[EvmInteractor] Deploying ${contractName}...`);

        // Wallet Validation (Crucial for EVM operations)
        if (!wallet || typeof wallet.sendTransaction !== 'function' || typeof wallet.getAccounts !== 'function' || typeof wallet.getTransactionReceipt !== 'function') {
            throw new Error("Invalid or incomplete IEVMWallet provided for deployment. Requires sendTransaction, getAccounts, getTransactionReceipt.");
        }

        const abi = compiledContract.artifacts?.abi;
        const bytecode = compiledContract.artifacts?.bytecode;
        if (!abi || !bytecode) throw new Error(`Compiled artifacts for ${contractName} missing 'abi' or 'bytecode'.`);

        let txHash: string | undefined;
        try {
            // 1. Prepare Tx Data using ethers
            const factory = new ethers.ContractFactory(abi, bytecode);
            const overrides: ethers.Overrides = {};
            if (deployOptions.gasLimit) overrides.gasLimit = deployOptions.gasLimit;
            if (deployOptions.gasPrice) overrides.gasPrice = deployOptions.gasPrice;
            if (deployOptions.maxFeePerGas) overrides.maxFeePerGas = deployOptions.maxFeePerGas;
            if (deployOptions.maxPriorityFeePerGas) overrides.maxPriorityFeePerGas = deployOptions.maxPriorityFeePerGas;
            if (deployOptions.nonce) overrides.nonce = deployOptions.nonce;
            if (deployOptions.value) overrides.value = deployOptions.value;
            const deployTxRequest: TransactionRequest = await factory.getDeployTransaction(...constructorArgs, overrides);

            // 2. Map to GenericTransactionData
            const genericDeployTx: GenericTransactionData = {
                to: undefined, // Contract creation
                value: deployTxRequest.value?.toString(),
                data: deployTxRequest.data ?? undefined,
                options: { /* Map relevant options */ }
            };
            // Clean up undefined options (important for some wallets)
            Object.assign(genericDeployTx.options!, {
                gasLimit: deployTxRequest.gasLimit,
                gasPrice: deployTxRequest.gasPrice,
                maxFeePerGas: deployTxRequest.maxFeePerGas,
                maxPriorityFeePerGas: deployTxRequest.maxPriorityFeePerGas,
                nonce: deployTxRequest.nonce
            });
            Object.keys(genericDeployTx.options!).forEach(key =>
                genericDeployTx.options![key as keyof typeof genericDeployTx.options] === undefined &&
                delete genericDeployTx.options![key as keyof typeof genericDeployTx.options]
            );
            if (Object.keys(genericDeployTx.options!).length === 0) delete genericDeployTx.options;


            // 3. Send via Wallet Adapter
            console.log(`[EvmInteractor] Sending deployment tx for ${contractName} via wallet...`);
            txHash = await wallet.sendTransaction(genericDeployTx as any);
            console.log(`[EvmInteractor] Deployment tx sent: ${txHash}`);

            // 4. Wait for Receipt via Wallet Adapter
            console.log(`[EvmInteractor] Waiting for receipt for ${txHash}...`);
            let receipt: TransactionReceipt | null = null;
            const maxAttempts = 20; // ~2 minutes total wait time
            const waitTime = 6000; // 6 seconds
            for (let i = 0; i < maxAttempts; i++) {
                receipt = await wallet.getTransactionReceipt(txHash); // IEVMWallet guarantees this method
                if (receipt) {
                    console.log(`[EvmInteractor] Receipt found (attempt ${i + 1}). Status: ${receipt.status}`);
                    break;
                }
                if (i < maxAttempts - 1) await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            // 5. Process Receipt
            if (!receipt) throw new Error(`Deployment transaction ${txHash} did not confirm after ${maxAttempts} attempts.`);
            if (receipt.status === 0) throw new Error(`Deployment transaction ${txHash} failed (receipt status 0).`);
            if (!receipt.contractAddress) throw new Error(`Deployment transaction ${txHash} succeeded but receipt missing contractAddress.`);

            console.log(`[EvmInteractor] ${contractName} deployed successfully at ${receipt.contractAddress}`);

            // 6. Format Output
            const deployerAddress = receipt.from || (await wallet.getAccounts())[0]; // Get deployer address
            const deployedOutput: DeployedOutput = {
                contractId: receipt.contractAddress,
                deploymentInfo: {
                    transactionId: receipt.hash,
                    blockHeight: receipt.blockNumber,
                    gasUsed: receipt.gasUsed?.toString(),
                    effectiveGasPrice: receipt.gasPrice?.toString(), // Ethers v6 uses gasPrice in receipt
                    deployerAddress: deployerAddress,
                },
                contractInterface: abi // Include ABI in output
            };
            return deployedOutput;

        } catch (error: any) {
            console.error(`[EvmInteractor] Deployment of ${contractName} failed: ${error.message}`, error.stack);
            if (txHash) console.error("Failed Tx Hash:", txHash);
            // Re-throw a cleaner error
            throw new Error(`Deployment failed: ${error.message}`);
        }
    }

    async callContractMethod(input: CallInput): Promise<any> {
        const { contractId, functionName, args = [], wallet, contractInterface, callOptions = {} } = input;
        console.log(`[EvmInteractor] Calling ${functionName} on ${contractId}`);

        const abi = contractInterface; // ABI is now required in CallInput
        if (!abi) throw new Error(`ABI (contractInterface) is required in CallInput for contract ${contractId}`);

        let functionAbiFragment: ethers.FunctionFragment | null = null;
        try {
            const iface = new Interface(abi);
            functionAbiFragment = iface.getFunction(functionName);
            if (!functionAbiFragment) throw new Error('Function fragment not found'); // Should not happen if getFunction doesn't throw
        } catch (abiError: any) {
            throw new Error(`Error processing ABI for function '${functionName}': ${abiError.message}`);
        }

        const isWriteCall = !(functionAbiFragment.constant || functionAbiFragment.stateMutability === 'view' || functionAbiFragment.stateMutability === 'pure');

        if (isWriteCall) {
            // --- WRITE CALL ---
            console.log(`[EvmInteractor] Preparing WRITE call for ${functionName}...`);
            if (!wallet || typeof wallet.sendTransaction !== 'function') { // Check wallet is present and capable
                throw new Error("IEVMWallet with sendTransaction capability is required for write operations.");
            }

            try {
                // 1. Encode Function Data
                const iface = new Interface(abi); // Recreate or reuse iface
                const txData = iface.encodeFunctionData(functionName, args);

                // 2. Map to GenericTransactionData
                const genericWriteTx: GenericTransactionData = {
                    to: contractId,
                    data: txData,
                    value: callOptions.value?.toString(),
                    options: { /* Map relevant options */ }
                };
                // Clean up undefined options
                Object.assign(genericWriteTx.options!, {
                    gasLimit: callOptions.gasLimit,
                    gasPrice: callOptions.gasPrice,
                    maxFeePerGas: callOptions.maxFeePerGas,
                    maxPriorityFeePerGas: callOptions.maxPriorityFeePerGas,
                    nonce: callOptions.nonce
                });
                Object.keys(genericWriteTx.options!).forEach(key =>
                    genericWriteTx.options![key as keyof typeof genericWriteTx.options] === undefined &&
                    delete genericWriteTx.options![key as keyof typeof genericWriteTx.options]
                );
                if (Object.keys(genericWriteTx.options!).length === 0) delete genericWriteTx.options;


                // 3. Send via Wallet Adapter
                console.log(`[EvmInteractor] Sending write tx for ${functionName} via wallet...`);
                const txHash = await wallet.sendTransaction(genericWriteTx as any);
                console.log(`[EvmInteractor] Write tx sent: ${txHash}`);

                // Return hash (user can wait separately if needed)
                // Consider adding an option in callOptions to wait for receipt here?
                return { transactionHash: txHash };

            } catch (error: any) {
                console.error(`[EvmInteractor] Write call to ${functionName} failed: ${error.message}`, error.stack);
                throw new Error(`Write call to method '${functionName}' failed: ${error.message}`);
            }
        } else {
            // --- READ CALL ---
            console.log(`[EvmInteractor] Preparing READ call for ${functionName}...`);
            let readProvider: Provider | undefined = this.defaultProvider; // Use the interactor's default provider

            // If a wallet IS provided, try to get its provider (might be connected to a different network!)
            // This logic needs refinement based on IEVMWallet interface - does it guarantee getProvider?
            // For now, we prioritize the default provider for consistency in read-only scenarios without a wallet.
            // If a wallet is present, it's primarily for WRITES in this model. Reads *could* use it, but let's keep it simple first.

            if (!readProvider) {
                throw new Error("Provider is required for read operations. Configure the adapter with 'providerConfig' or ensure the wallet provides one.");
            }

            try {
                // 1. Create Contract Instance with Provider
                const contract = new ethers.Contract(contractId, abi, readProvider);

                // 2. Execute Read Call
                console.log(`[EvmInteractor] Executing read call: ${functionName}(${args.join(', ')})`);
                // Ethers v6 uses contract.functionName(...args, overrides?)
                // Read calls usually don't need overrides, but pass if provided in callOptions
                const readOverrides: ethers.Overrides = {};
                if (callOptions.blockTag) readOverrides.blockTag = callOptions.blockTag;
                // Add other relevant read overrides if needed

                const result = await (contract[functionName] as Function)(...args, readOverrides);
                console.log(`[EvmInteractor] Read call result for ${functionName}:`, result);
                return result;

            } catch (error: any) {
                console.error(`[EvmInteractor] Read call to ${functionName} failed: ${error.message}`, error.stack);
                if (error.message.includes('call revert exception')) {
                    console.error("Read call reverted. Check contract state, arguments, and ensure the contract exists at the address on the connected network.");
                }
                throw new Error(`Read call to method '${functionName}' failed: ${error.message}`);
            }
        }
    }
}