import { MinimalLiFiAdapter } from './LI.FI.Adapter.js';
import { CrossChainAdapterType } from '../types/index.js';
import { registry } from '@m3s/common';

registry.registerAdapter('crosschain', {
  name: 'lifi',
  module: 'crosschain',
  adapterType: CrossChainAdapterType['aggregator'],
  adapterClass: MinimalLiFiAdapter,
  requirements: []
});