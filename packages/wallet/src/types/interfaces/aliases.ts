import { IAdapterIdentity, IAdapterLifecycle } from "@m3s/shared";
import { IEventEmitter, IMessageSigner, ITransactionHandler, ITypedDataSigner, IGasEstimation, ITokenOperations, IRPCHandler, ITransactionStatus, IAccountManager, IConnectionHandler, INetworkManager } from "./base.js";

/**
 * Core wallet interface - only essential wallet operations
 */
export interface ICoreWallet extends
  IAdapterIdentity,
  IAdapterLifecycle,
  IConnectionHandler,
  IAccountManager,
  INetworkManager {}

/**
 * Complete EVM wallet interface - composed of all EVM-specific capabilities
 */
export interface IEVMWallet extends
  ICoreWallet,
  IEventEmitter,
  IMessageSigner,
  ITransactionHandler,
  ITypedDataSigner,
  IGasEstimation,
  ITokenOperations,
  IRPCHandler,
  ITransactionStatus {}