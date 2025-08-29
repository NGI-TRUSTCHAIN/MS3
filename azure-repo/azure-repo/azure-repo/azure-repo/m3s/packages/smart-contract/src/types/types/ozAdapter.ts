import { IOpenZeppelinAdapterOptionsV1 } from '../../adapters/index.js';
import { ERC20ContractInput, ERC721ContractInput, ERC1155ContractInput } from '../interfaces/base.js';

export type CairoWizardKey = 'erc20' | 'erc721' | 'erc1155' | 'account' | 'governor' | 'vesting' | 'custom';
export type StylusWizardKey = 'erc20' | 'erc721' | 'erc1155';
export type CairoContractOptions = any;
export type StellarContractOptions = any;
export type StylusContractOptions = any;

export type SmartContractAdapterOptions = IOpenZeppelinAdapterOptionsV1;

/** Input for generating contract source code */
export type GenerateContractInput = ERC20ContractInput | ERC721ContractInput | ERC1155ContractInput;