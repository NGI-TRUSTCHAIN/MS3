import { Requirement, registry, ContractHandlerType, EnvironmentRequirements, RuntimeEnvironment } from "@m3s/smart-contract";
import { OpenZeppelinAdapter } from "./openzeppelin.adapter";

const openZeppelinRequirements: Requirement[] = [];

const openZeppelinEnvironment: EnvironmentRequirements = {
  supportedEnvironments: [RuntimeEnvironment.SERVER],
  limitations: [
    'Smart contract compilation requires Node.js environment with file system access.',
    'Hardhat compiler execution requires shell command capabilities.',
    'Cannot be used in browser environments due to child_process dependency.',
    'Requires write permissions for temporary contract compilation directories.'
  ]
};

registry.registerAdapter('contractHandler', {
  name: 'openZeppelin',
  version: '1.0.0',
  module: 'contractHandler',
  adapterType: ContractHandlerType.openZeppelin,
  adapterClass: OpenZeppelinAdapter,
  environment: openZeppelinEnvironment,
  requirements: openZeppelinRequirements,
});