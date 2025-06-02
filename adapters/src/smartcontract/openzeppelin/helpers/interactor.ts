import { ethers, Provider, Interface, Contract } from "ethers"; // Signer is not directly used here from wallet
import { AdapterError, GenericTransactionData, NetworkConfig } from "@m3s/wallet";
import { DeployInput, DeployedOutput, CallInput } from "@m3s/smart-contract";

export default class EvmInteractor {
    private defaultProvider?: Provider; // This is an ethers.Provider

    constructor(providerConfig?: NetworkConfig) {
        console.log('[EvmInteractor Constructor] Received providerConfig:', JSON.stringify(providerConfig, null, 2));

        let rpcUrlToUse: string | undefined = undefined;

        if (providerConfig && providerConfig.rpcUrls && Array.isArray(providerConfig.rpcUrls) && providerConfig.rpcUrls.length > 0) {
            rpcUrlToUse = providerConfig.rpcUrls[0];
            console.log(`[EvmInteractor] Using rpcUrls[0] as the RPC endpoint: ${rpcUrlToUse}`);
        }

        if (!rpcUrlToUse) {
            if (providerConfig) {
                console.log('[EvmInteractor] providerConfig present, but no suitable rpcUrls[0] or rpcUrl found.');
            } else {
                console.log('[EvmInteractor] providerConfig is undefined.');
            }
        }

        if (rpcUrlToUse) {
            try {
                const chainIdToUse = providerConfig?.chainId ? Number(providerConfig.chainId) : undefined;
                this.defaultProvider = new ethers.JsonRpcProvider(rpcUrlToUse, chainIdToUse);
                console.log(`[EvmInteractor] Default provider configured for reads from: ${rpcUrlToUse} with chainId: ${chainIdToUse}`);
            } catch (error: any) {
                console.error(`[EvmInteractor] Failed to initialize default provider from config: ${rpcUrlToUse}`, error.message);
                this.defaultProvider = undefined;
            }
        } else {
            console.log('[EvmInteractor] Initialized without a default provider (no suitable RPC URL found in providerConfig).');
        }
    }

    async deployContract(input: DeployInput): Promise<DeployedOutput> {
        const { compiledContract, constructorArgs = [], wallet, deployOptions = {} } = input;

        if (!wallet) {
            throw new AdapterError("Wallet is required for deployment.");
        }

        if (!compiledContract.artifacts.bytecode || !compiledContract.artifacts.abi) {
            throw new AdapterError("Bytecode and ABI are required for deployment.");
        }

        const factory = new ethers.ContractFactory(compiledContract.artifacts.abi, compiledContract.artifacts.bytecode);
        const deployTxUnsigned = await factory.getDeployTransaction(...constructorArgs); // Ethers v6

        let finalGasLimit: string | undefined;

        if (deployOptions.gasLimit !== undefined) {
            if (typeof deployOptions?.gasLimit === 'string' || typeof deployOptions?.gasLimit === 'bigint') {
                finalGasLimit = deployOptions.gasLimit.toString();
            } else if (typeof deployOptions.gasLimit === 'string') {
                finalGasLimit = deployOptions.gasLimit;
            } else {
                console.warn(`[EvmInteractor] Unexpected type for deployOptions.gasLimit: ${typeof deployOptions.gasLimit}. Passing as is.`);
                finalGasLimit = deployOptions.gasLimit as any;
            }
        } else if (typeof wallet.estimateGas === 'function') {
            const estimateTx: GenericTransactionData = {
                data: deployTxUnsigned.data,
                value: deployOptions.value !== undefined ? ethers.toBeHex(ethers.toBigInt(deployOptions.value)) : undefined,
            };
            try {
                console.log(`[EvmInteractor] gasLimit not provided for deployment, attempting to estimate... EstimateTx:`, JSON.stringify(estimateTx).slice(0,17));
                const estimatedFee = await wallet.estimateGas(estimateTx);
                if (estimatedFee && estimatedFee.gasLimit !== undefined && estimatedFee.gasLimit !== null) {
                    finalGasLimit = estimatedFee.gasLimit.toString();
                    console.log(`[EvmInteractor] Estimated gasLimit for deployment: ${finalGasLimit}`);
                } else {
                    console.warn(`[EvmInteractor] Gas estimation for deployment returned no gasLimit. estimatedFee: ${JSON.stringify(estimatedFee)}, estimatedFee.gasLimit: ${estimatedFee?.gasLimit}. Proceeding without explicit gasLimit.`);
                }
            } catch (estimationError: any) {
                console.warn(`[EvmInteractor] Gas estimation for deployment FAILED.`);
                console.warn(`[EvmInteractor] Error Message: ${estimationError.message}`);
                console.warn(`[EvmInteractor] Error Code: ${estimationError.code}`);
                // Use the helper for logging the error object if it might contain BigInts
                console.warn(`[EvmInteractor] Full Error Object (raw):`, estimationError); // Keep this for full object inspection if needed
                console.warn(`[EvmInteractor] Stringified Error Object: ${estimationError}`);
                console.warn(`[EvmInteractor] Proceeding without explicit gasLimit.`);
            }
        }
        
        const genericTx: GenericTransactionData = {
            data: deployTxUnsigned.data, // This is the init code + constructor args
            // 'to' is undefined for contract creation
            value: deployOptions.value,
            options: { // Pass through relevant options
                gasLimit: finalGasLimit,
                gasPrice: deployOptions.gasPrice,
                maxFeePerGas: deployOptions.maxFeePerGas,
                maxPriorityFeePerGas: deployOptions.maxPriorityFeePerGas,
                nonce: deployOptions.nonce,
                // chainId: deployOptions.chainId, // Wallet should manage its chainId
            }
        };

        try {
            console.log(`[EvmInteractor] Sending deployment tx for ${compiledContract.metadata?.contractName || 'contract'} via wallet...`);
            const txHash = await wallet.sendTransaction(genericTx);
            console.log(`[EvmInteractor] Deployment tx sent: ${txHash}`);

            console.log(`[EvmInteractor] Waiting for receipt for ${txHash}...`);
            let receipt: any = null;
            let attempts = 0;
            const maxAttempts = deployOptions.maxAttempts || 120;
            const pollInterval = deployOptions.pollInterval || 5000;

            while (attempts < maxAttempts) {
                receipt = await wallet.getTransactionReceipt(txHash);
                if (receipt) {
                    console.log(`[EvmInteractor] Receipt found (attempt ${attempts + 1}). Status: ${receipt.status}`);
                    break;
                }
                attempts++;
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                if (attempts % 6 === 0) { // Log every 30s
                    console.log(`[EvmInteractor] Still waiting for receipt for ${txHash} (attempt ${attempts})...`);
                }
            }

            if (!receipt) {
                throw new AdapterError(`Timeout waiting for deployment transaction receipt: ${txHash}`);
            }
            if (receipt.status === 0 || receipt.status === null) { // Check for null status as well
                throw new AdapterError(`Contract deployment failed (tx status ${receipt.status}): ${txHash}. Receipt: ${JSON.stringify(receipt)}`);
            }
            if (!receipt.contractAddress) {
                throw new AdapterError(`Contract address not found in receipt for tx: ${txHash}. Receipt: ${JSON.stringify(receipt)}`);
            }
            console.log(`[EvmInteractor] ${compiledContract.metadata?.contractName || 'Contract'} deployed successfully at ${receipt.contractAddress}`);

            return {
                contractId: receipt.contractAddress,
                deploymentInfo: {
                    transactionId: txHash,
                    blockHeight: receipt.blockNumber,
                    deployerAddress: receipt.from,
                },
                contractInterface: compiledContract.artifacts.abi,
            };
        } catch (error: any) {
            console.error(`[EvmInteractor] Deployment error:`, error);
            const cause = error instanceof Error ? error : undefined;
            throw new AdapterError(`Deployment failed: ${error.message || 'Unknown deployment error'}`, { cause });
        }
    }

    async callContractMethod(input: CallInput): Promise<any> {
        const { contractId, functionName, args = [], wallet, contractInterface, callOptions = {} } = input;

        if (!contractId || !ethers.isAddress(contractId)) {
            throw new AdapterError(`Invalid contract address: ${contractId}`);
        }
        if (!contractInterface) {
            throw new AdapterError('Contract ABI (contractInterface) is required for calling a method.');
        }
        if (!functionName) {
            throw new AdapterError('Function name is required.');
        }

        const iface = new Interface(contractInterface);
        const fragment = iface.getFunction(functionName);
        if (!fragment) {
            throw new AdapterError(`Function '${functionName}' not found in ABI.`);
        }
        const isWriteOperation = !(fragment.stateMutability === 'view' || fragment.stateMutability === 'pure');

        if (isWriteOperation) {
            if (!wallet) {
                throw new AdapterError(`Wallet is required for write operation: ${functionName}`);
            }
            const callData = iface.encodeFunctionData(fragment, args);

            let finalGasLimit: string | undefined;

            if (callOptions?.gasLimit) {
                if (typeof callOptions.gasLimit === 'bigint' || typeof callOptions.gasLimit === 'number') {
                    finalGasLimit = callOptions.gasLimit.toString();
                } else if (typeof callOptions.gasLimit === 'string') {
                    finalGasLimit = callOptions.gasLimit;
                } else {
                    console.warn(`[EvmInteractor] Unexpected type for callOptions.gasLimit: ${typeof callOptions.gasLimit}. Passing as is.`);
                    finalGasLimit = callOptions.gasLimit as any;
                }
            } else if (typeof wallet.estimateGas === 'function') {
                const estimateTx: GenericTransactionData = {
                    to: contractId,
                    data: callData,
                    value: callOptions?.value !== undefined ? ethers.toBeHex(ethers.toBigInt(callOptions.value)) : undefined,
                };
                try {
                    console.log(`[EvmInteractor] gasLimit not provided for '${functionName}', attempting to estimate... EstimateTx:`, JSON.stringify(estimateTx));
                    const estimatedFee = await wallet.estimateGas(estimateTx);
                    if (estimatedFee && estimatedFee.gasLimit !== undefined && estimatedFee.gasLimit !== null) {
                        finalGasLimit = estimatedFee.gasLimit.toString();
                        console.log(`[EvmInteractor] Estimated gasLimit for '${functionName}': ${finalGasLimit}`);
                    } else {
                        console.warn(`[EvmInteractor] Gas estimation for '${functionName}' returned no gasLimit. estimatedFee: ${JSON.stringify(estimatedFee)}, estimatedFee.gasLimit: ${estimatedFee?.gasLimit}. Proceeding without explicit gasLimit.`);
                    }
                } catch (estimationError: any) {
                    console.warn(`[EvmInteractor] Gas estimation for '${functionName}' FAILED.`);
                    console.warn(`[EvmInteractor] Error Message: ${estimationError.message}`);
                    console.warn(`[EvmInteractor] Error Code: ${estimationError.code}`);
                    // console.warn(`[EvmInteractor] Error Stack: ${estimationError.stack}`); // Can be very verbose
                    console.warn(`[EvmInteractor] Full Error Object (raw) for ${functionName}:`, estimationError); // Log the raw error object
                    console.warn(`[EvmInteractor] Stringified Error Object for ${functionName}: ${JSON.stringify(estimationError, Object.getOwnPropertyNames(estimationError))}`); // Try to get more details
                    console.warn(`[EvmInteractor] Proceeding without explicit gasLimit.`);
                }
            }

            const genericTx: GenericTransactionData = {
                to: contractId,
                data: callData,
                value: callOptions?.value,
                options: {
                    gasLimit: finalGasLimit,
                    gasPrice: callOptions?.gasPrice,
                    maxFeePerGas: callOptions?.maxFeePerGas,
                    maxPriorityFeePerGas: callOptions?.maxPriorityFeePerGas,
                    nonce: callOptions?.nonce,
                }
            };
            try {
                console.log(`[EvmInteractor] Sending WRITE tx '${functionName}' to ${contractId} via wallet with args:`, args);
                const txHash = await wallet.sendTransaction(genericTx);
                console.log(`[EvmInteractor] Write tx sent: ${txHash} for ${functionName}`);
                return { transactionHash: txHash }; // Or wait for receipt if desired
            } catch (error: any) {
                console.error(`[EvmInteractor] Error sending write tx '${functionName}' on ${contractId}:`, error);
                throw new AdapterError(`Failed to send tx for method '${functionName}': ${error.message}`, {
                    cause: error, details: { contractId, functionName, args }
                });
            }
        } else { // READ OPERATION
            if (!this.defaultProvider) {
                throw new AdapterError("Default provider not configured in EvmInteractor for read operations.");
            }
            try {
                const contract = new Contract(contractId, contractInterface, this.defaultProvider);
                console.log(`[EvmInteractor] Calling READ operation '${functionName}' on ${contractId} with args:`, args);
                const result = await contract[functionName](...args);
                console.log(`[EvmInteractor] Read operation '${functionName}' result:`, result);
                return result;
            } catch (error: any) {
                console.error(`[EvmInteractor] Error calling read method '${functionName}' on ${contractId}:`, error);
                let errMsg = error.message;
                if (error.reason) errMsg = `Execution reverted: ${error.reason}`;
                else if (error.data?.message) errMsg = `Execution reverted: ${error.data.message}`;
                else if (error.error?.message) errMsg = error.error.message;
                throw new AdapterError(`Failed to call read method '${functionName}': ${errMsg}`, {
                    cause: error, details: { contractId, functionName, args }
                });
            }
        }
    }
}