import { IAdapterIdentity, IAdapterLifecycle } from "@m3s/shared";
import { IQuoteProvider, IOperationHandler, IChainDiscovery, IGasEstimator, IOperationMaintenance } from "./base.js";

export interface ICrossChain extends 
  IAdapterIdentity,
  IAdapterLifecycle,
  IQuoteProvider,
  IOperationHandler,
  IChainDiscovery,
  IGasEstimator,
  IOperationMaintenance 
  {}