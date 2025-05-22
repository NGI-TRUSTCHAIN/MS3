import { ContractHandlerType } from '../types/index.js';
import { OpenZeppelinAdapter } from './openZeppelin/index.js';
import { registry, Requirement } from '@m3s/common';

const openZeppelinRequirements: Requirement[] = [];

registry.registerAdapter('contractHandler', {
  name: 'openZeppelin',
  module: 'contractHandler',
  adapterType: ContractHandlerType.openZeppelin,
  adapterClass: OpenZeppelinAdapter,
  requirements: openZeppelinRequirements,
});