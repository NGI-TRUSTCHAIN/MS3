import { registry } from '../registry.js';
import { ContractHandlerType } from '../types/index.js';
import { OpenZeppelinAdapter } from './openZeppelinAdapter.js';

registry.registerAdapter('contractHandler', {
  name: 'openZeppelin',
  module: 'contractHandler',
  adapterType: ContractHandlerType['openZeppelin'],
  adapterClass: OpenZeppelinAdapter,
  requirements: []
});