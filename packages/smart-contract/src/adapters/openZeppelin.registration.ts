import { ContractHandlerType } from '../types/index.js';
import { OpenZeppelinAdapter } from './openZeppelin/index.js'; // Updated path
import { registry } from '@m3s/common';

registry.registerAdapter('contractHandler', {
  name: 'openZeppelin',
  module: 'contractHandler',
  adapterType: ContractHandlerType['openZeppelin'],
  adapterClass: OpenZeppelinAdapter,
  requirements: []
});