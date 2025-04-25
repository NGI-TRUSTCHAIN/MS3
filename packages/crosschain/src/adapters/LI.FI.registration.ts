import { registry } from '../registry.js';
import { MinimalLiFiAdapter } from './LI.FI.Adapter.js';
import { CrossChainAdapterType } from '../types/index.js';

registry.registerAdapter('crosschain', {
  name: 'lifi-minimal',
  module: 'crosschain',
  adapterType: CrossChainAdapterType['aggregator'],
  adapterClass: MinimalLiFiAdapter,
  requirements: []
});