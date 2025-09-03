import { IAdapterIdentity, IAdapterLifecycle } from "@m3s/shared";
import { IContractGenerator, IContractCompiler } from "./base.js";

/**
 * Complete contract handler interface - composed of all contract operations
 */
export interface IBaseContractHandler extends
  IAdapterIdentity,
  IAdapterLifecycle,
  IContractGenerator,
  IContractCompiler { }