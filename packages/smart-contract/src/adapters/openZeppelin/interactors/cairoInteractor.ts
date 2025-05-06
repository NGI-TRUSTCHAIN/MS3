// import { DeployInput, DeployedOutput, CallInput } from '../../../types/index.js'; // Adjust path
// import {
//     Account,
//     RpcProvider,
//     Contract,
//     CompiledSierra,
//     CompiledSierraCasm,
//     CallData,
//     validateAndParseAddress,
//     constants,
//     num,
//     shortString,
//     ProviderInterface,
//     GetTransactionReceiptResponse,
//     DeclareTransactionReceiptResponse,
//     SignerInterface // <<< Import SignerInterface
// } from "starknet";
// import { ICoreWallet } from '@m3s/wallet';
// import { ethers } from 'ethers';


// interface IStarknetWallet extends ICoreWallet {
//     getStarknetAccount(): Promise<Account | undefined>;
// }
// function isStarknetWallet(wallet: ICoreWallet | undefined): wallet is IStarknetWallet {
//     return !!wallet && typeof (wallet as any).getStarknetAccount === 'function';
// }

// async function getStarknetSignerAndProvider(wallet?: ICoreWallet, defaultProvider?: RpcProvider, defaultAccount?: Account): Promise<{ account?: Account, provider: ProviderInterface }> {
//     let accountToUse: Account | undefined = undefined;

//     // Priority 1: Account from the provided wallet
//     if (isStarknetWallet(wallet)) {
//         accountToUse = await wallet.getStarknetAccount();
//     }

//     // Priority 2: Default Account from interactor
//     if (!accountToUse) {
//         accountToUse = defaultAccount;
//     }

//     // --- Determine the Provider to use ---
//     let providerToUse: ProviderInterface;

//     if (accountToUse) {
//         // If we have an Account, IT IS the provider (due to inheritance)
//         providerToUse = accountToUse;
//     } else if (defaultProvider) {
//         // If no Account, use the defaultProvider if available
//         providerToUse = defaultProvider;
//     } else {
//         // Otherwise, fallback to a new Sepolia RpcProvider
//         console.warn("[CairoInteractor] No account or default provider found, defaulting to Starknet Sepolia Testnet RPC for provider.");
//         providerToUse = new RpcProvider({ nodeUrl: constants.NetworkName.SN_SEPOLIA });
//     }

//     // --- Optional: Ensure Account uses the final Provider ---
//     // If an account exists but was created with a *different* provider instance
//     // than the one we ultimately decided to use (providerToUse), recreate the account
//     // instance to ensure consistency. This is mainly relevant if defaultAccount was
//     // passed without a provider, but defaultProvider *was* passed.
//     if (accountToUse && accountToUse !== providerToUse && providerToUse instanceof RpcProvider) {
//         // We need the signer interface to recreate the account
//         const signer: SignerInterface = accountToUse.signer; // Access the signer
//         console.log(`[CairoInteractor] Re-creating account instance ${accountToUse.address} with the determined provider.`);
//         accountToUse = new Account(providerToUse, accountToUse.address, signer);
//     }

//     // Return the determined account (if any) and the provider instance to use for calls
//     return { account: accountToUse, provider: providerToUse };
// }

// export class CairoInteractor {
//     private defaultProvider?: RpcProvider;
//     private defaultAccount?: Account; 

//     // TODO: Define constructor, likely needs provider/account info
//     constructor(defaultProvider?: RpcProvider, defaultAccount?: Account) {
//         this.defaultProvider = defaultProvider;
//         // Ensure the defaultAccount has a provider if one is available
//         if (defaultAccount) {
//             if (defaultProvider && defaultAccount !== defaultProvider) {
//                 // Recreate account instance ONLY if the default account lacks a provider
//                 // but a default provider IS available for the interactor.
//                 const signer: SignerInterface = defaultAccount.signer; // Access signer
//                 this.defaultAccount = new Account(defaultProvider, defaultAccount.address, signer);
//                 console.log(`[CairoInteractor] Re-created default account instance to use the provided default provider.`);
//            } else {
//                 this.defaultAccount = defaultAccount; // Use the provided account as is
//             }
//             console.log(`[CairoInteractor] Initialized with default Account: ${this.defaultAccount.address}`);
//         } else if (this.defaultProvider) {
//             console.log(`[CairoInteractor] Initialized with default Provider.`);
//         } else {
//             console.log(`[CairoInteractor] Initialized without default Provider or Account.`);
//         }
//     }

//     private isTxSuccess(receipt: GetTransactionReceiptResponse | undefined | null): boolean {
//         // 1. Handle the case where the receipt doesn't exist (e.g., transaction not found yet)
//         if (!receipt) {
//           return false;
//         }
      
//         // 2. Use the built-in helper method provided by starknet.js
//         // This method correctly checks the underlying execution_status.
//         return receipt.isSuccess();
      
//         /*
//          * Explanation of what receipt.isSuccess() likely does internally (for understanding):
//          *
//          * // It checks if the receipt object exists and has the necessary properties.
//          * // Then it primarily checks the execution status:
//          * return receipt.execution_status === TransactionExecutionStatus.SUCCEEDED;
//          *
//          * // It might also implicitly check that it's not a 'REJECTED' status,
//          * // although 'REJECTED' wouldn't typically have an execution_status.
//          * // The ReceiptTx class handles these different receipt structures.
//          */
//       }

//     async deployContract(input: DeployInput): Promise<DeployedOutput> {
//         const { compiledContract, constructorArgs = [], wallet, deployOptions = {} } = input;
//         const starknetWallet = wallet as IStarknetWallet | undefined; // Cast wallet

//         // Get Account and Provider using the helper
//         const { account, provider } = getStarknetSignerAndProvider(starknetWallet, this.defaultProvider, this.defaultAccount);

//         // Deployment requires an Account
//         if (!account) {
//             throw new Error("[CairoInteractor] Deployment requires a Starknet wallet/account.");
//         }

//         const contractName = compiledContract.metadata?.contractName || 'UnknownCairoContract';
//         console.log(`[CairoInteractor] Deploying ${contractName} using account ${account.address}...`);

//         // --- Artifact Validation ---
//         const sierra = compiledContract.artifacts?.sierra as CompiledSierra | undefined;
//         const casm = compiledContract.artifacts?.casm as CompiledSierraCasm | undefined;

//         if (!sierra || typeof sierra !== 'object' || !sierra.program || !sierra.abi) {
//             throw new Error(`Compiled artifacts for ${contractName} missing valid Sierra JSON object.`);
//         }
//         if (!casm || typeof casm !== 'object' || !casm.bytecode || !casm.entry_points_by_type) {
//             // Note: Deployment *might* work without CASM locally if node handles compilation,
//             // but it's generally required for declaration.
//             console.warn(`[CairoInteractor] Compiled artifacts for ${contractName} missing CASM JSON object. Declaration might fail.`);
//             // Depending on strictness, you might throw an error here instead.
//         }

//         let declareTxHash: string | undefined;
//         let deployTxHash: string | undefined;

//         try {
//             // --- 1. Declare Sierra Class ---
//             console.log(`[CairoInteractor] Declaring Sierra class for ${contractName}...`);
//             // Ensure CASM is provided for declaration
//             if (!casm) {
//                 throw new Error("CASM artifact is required for declaring the contract class.");
//             }

//             const declarePayload: DeclareDeployV2Payload = {
//                 contract: sierra,
//                 casm: casm,
//                 // constructorCalldata: constructorArgs, // Constructor args go in deploy, not declare
//             };

//             // Estimate fee for declare
//             const declareFee = await account.estimateDeclareFee(declarePayload);
//             console.log(`[CairoInteractor] Estimated Declare Fee: ${ethers.formatUnits(declareFee.suggestedMaxFee, 'wei')} STRK (Max)`); // Use ethers for formatting bigint

//             // Send declare transaction
//             const declareResponse = await account.declare(declarePayload, { maxFee: declareFee.suggestedMaxFee });
//             declareTxHash = declareResponse.transaction_hash;
//             console.log(`[CairoInteractor] Declare transaction sent: ${declareTxHash}`);
//             console.log(`[CairoInteractor] Waiting for declare transaction receipt...`);
//             const declareReceipt = await provider.waitForTransaction(declareTxHash); // Use provider from helper

//             if (!declareReceipt.isSuccess()) {
//                  throw new Error(`Declare transaction ${declareTxHash} failed. Status: ${declareReceipt.status}, Revert Reason: ${declareReceipt.revert_reason}`);
//             }
//             const declaredClassHash = declareResponse.class_hash;
//             console.log(`[CairoInteractor] Sierra class declared successfully. Class Hash: ${declaredClassHash}`);


//             // --- 2. Deploy Contract using Declared Class Hash ---
//             console.log(`[CairoInteractor] Deploying contract instance from class hash ${declaredClassHash}...`);

//             // Compile constructor args (if any)
//             const contractAbi = sierra.abi;
//             const myCallData = new CallData(contractAbi);
//             const compiledConstructorArgs = constructorArgs.length > 0
//                 ? myCallData.compile("constructor", constructorArgs) // Use the specific constructor name if different
//                 : [];
//             console.log(`[CairoInteractor] Compiled Constructor Args:`, compiledConstructorArgs);


//             const deployPayload = {
//                 classHash: declaredClassHash,
//                 constructorCalldata: compiledConstructorArgs,
//                 // salt: undefined, // Optional: for deterministic address
//                 // unique: true, // Optional: prevent deploying same contract with same salt
//             };

//             // Estimate fee for deploy
//             const deployFee = await account.estimateDeployFee(deployPayload);
//             console.log(`[CairoInteractor] Estimated Deploy Fee: ${ethers.formatUnits(deployFee.suggestedMaxFee, 'wei')} STRK (Max)`);

//             // Send deploy transaction
//             const deployResponse = await account.deployContract(deployPayload, { maxFee: deployFee.suggestedMaxFee });
//             deployTxHash = deployResponse.transaction_hash;
//             const deployedContractAddress = deployResponse.contract_address; // Address is available immediately

//             console.log(`[CairoInteractor] Deploy transaction sent: ${deployTxHash}`);
//             console.log(`[CairoInteractor] Predicted Contract Address: ${deployedContractAddress}`);
//             console.log(`[CairoInteractor] Waiting for deploy transaction receipt...`);
//             const deployReceipt = await provider.waitForTransaction(deployTxHash);

//              if (!deployReceipt.isSuccess()) {
//                  throw new Error(`Deploy transaction ${deployTxHash} failed. Status: ${deployReceipt.status}, Revert Reason: ${deployReceipt.revert_reason}`);
//             }
//             console.log(`[CairoInteractor] Contract ${contractName} deployed successfully at ${deployedContractAddress}`);


//             // --- 3. Format Output ---
//             const deployedOutput: DeployedOutput = {
//                 contractId: deployedContractAddress,
//                 deploymentInfo: {
//                     transactionId: deployTxHash, // Deploy tx hash
//                     declareTransactionId: declareTxHash, // Include declare tx hash
//                     classHash: declaredClassHash,
//                     blockHeight: deployReceipt.block_number, // Block number from deploy receipt
//                     gasUsed: deployReceipt.actual_fee ? ethers.formatUnits(deployReceipt.actual_fee, 'wei') : undefined, // Actual fee in STRK (wei)
//                     effectiveGasPrice: undefined, // Starknet fee model is different
//                     deployerAddress: account.address,
//                 },
//                 contractInterface: contractAbi // Include ABI
//             };
//             return deployedOutput;

//         } catch (error: any) {
//             console.error(`[CairoInteractor] Deployment of ${contractName} failed: ${error.message}`, error.stack);
//             if (deployTxHash) console.error("Failed Deploy Tx Hash:", deployTxHash);
//             if (declareTxHash) console.error("Failed Declare Tx Hash:", declareTxHash);
//             // Re-throw a cleaner error
//             throw new Error(`Cairo Deployment failed: ${error.message}`);
//         }
//     }

//     async callContractMethod(input: CallInput): Promise<any> {
//         const { contractId, functionName, args = [], wallet, contractInterface, callOptions = {} } = input;
//         const starknetWallet = wallet as IStarknetWallet | undefined; // Cast wallet

//         // Get Account and Provider using the helper
//         const { account, provider } = getStarknetSignerAndProvider(starknetWallet, this.defaultProvider, this.defaultAccount);

//         // Validate Contract ID
//         let validatedContractId: string;
//         try {
//             validatedContractId = validateAndParseAddress(contractId);
//         } catch (e) {
//             throw new Error(`Invalid Starknet contract address provided: ${contractId}`);
//         }

//         console.log(`[CairoInteractor] Calling ${functionName} on ${validatedContractId}`);

//         const abi = contractInterface; // ABI is required
//         if (!abi) throw new Error(`ABI (contractInterface) is required in CallInput for Starknet contract ${contractId}`);

//         // --- Determine Read vs Write ---
//         // Starknet.js v6 doesn't directly expose 'stateMutability' easily from ABI alone before creating a Contract instance.
//         // We'll infer: if an account is available, assume it *could* be a write. If not, it *must* be a read.
//         // A more robust approach might involve checking the ABI structure for common patterns or requiring a hint in callOptions.
//         const canWrite = !!account;
//         const forceReadOnly = callOptions?.readOnly === true; // Allow user to force read-only

//         // Use CallData for compiling arguments regardless of read/write
//         let compiledArgs: num.BigNumberish[] | undefined;
//         try {
//             const myCallData = new CallData(abi);
//             compiledArgs = args.length > 0 ? myCallData.compile(functionName, args) : [];
//         } catch (compileError: any) {
//              throw new Error(`Failed to compile arguments for function '${functionName}': ${compileError.message}`);
//         }


//         if (!canWrite || forceReadOnly) {
//             // --- READ CALL ---
//             console.log(`[CairoInteractor] Preparing READ call for ${functionName}...`);
//             try {
//                 const result = await provider.callContract({
//                     contractAddress: validatedContractId,
//                     entrypoint: functionName,
//                     calldata: compiledArgs
//                 }, callOptions?.blockIdentifier); // Pass block identifier if provided

//                 console.log(`[CairoInteractor] Read call result for ${functionName}:`, result.result);

//                 // Optional: Parse result using ABI (if needed, starknet.js often returns parsed values)
//                 // const parsedResult = myCallData.parse(functionName, result.result);
//                 // return parsedResult;

//                 return result.result; // Return the raw result array (usually strings)

//             } catch (error: any) {
//                 console.error(`[CairoInteractor] Read call to ${functionName} failed: ${error.message}`, error.stack);
//                  if (error.message.includes('Contract error') || error.message.includes('ENTRY_POINT_NOT_FOUND')) {
//                     console.error("Read call failed. Check contract address, function name, arguments, and ensure contract exists on the network.");
//                 }
//                 throw new Error(`Read call to method '${functionName}' failed: ${error.message}`);
//             }
//         } else {
//             // --- WRITE CALL (INVOKE) ---
//             console.log(`[CairoInteractor] Preparing WRITE call (invoke) for ${functionName}...`);
//             if (!account) { // Should be caught by canWrite, but double-check
//                  throw new Error("Starknet Account is required for write operations.");
//             }
//             try {
//                 // Estimate Fee
//                 const fee = await account.estimateInvokeFee({
//                     contractAddress: validatedContractId,
//                     entrypoint: functionName,
//                     calldata: compiledArgs
//                 });
//                  console.log(`[CairoInteractor] Estimated Invoke Fee: ${ethers.formatUnits(fee.suggestedMaxFee, 'wei')} STRK (Max)`);

//                 // Execute Transaction
//                 const invokeResponse = await account.execute(
//                     { // Single call format
//                         contractAddress: validatedContractId,
//                         entrypoint: functionName,
//                         calldata: compiledArgs
//                     },
//                     undefined, // Optional ABI (can be inferred if Contract instance used)
//                     { maxFee: fee.suggestedMaxFee } // Pass fee estimation
//                 );
//                 const txHash = invokeResponse.transaction_hash;
//                 console.log(`[CairoInteractor] Invoke transaction sent: ${txHash}`);

//                 // Option: Wait for receipt? Or just return hash?
//                 if (callOptions?.waitForReceipt) {
//                     console.log(`[CairoInteractor] Waiting for invoke transaction receipt...`);
//                     const receipt = await provider.waitForTransaction(txHash);
//                      if (!receipt.isSuccess()) {
//                          throw new Error(`Invoke transaction ${txHash} failed. Status: ${receipt.status}, Revert Reason: ${receipt.revert_reason}`);
//                     }
//                     console.log(`[CairoInteractor] Invoke transaction successful. Block: ${receipt.block_number}`);
//                     return {
//                         transactionHash: txHash,
//                         receipt: receipt // Include full receipt if waited
//                     };
//                 } else {
//                     // Return only the hash if not waiting
//                     return { transactionHash: txHash };
//                 }

//             } catch (error: any) {
//                 console.error(`[CairoInteractor] Write call to ${functionName} failed: ${error.message}`, error.stack);
//                 throw new Error(`Write call (invoke) to method '${functionName}' failed: ${error.message}`);
//             }
//         }
//     }
// }