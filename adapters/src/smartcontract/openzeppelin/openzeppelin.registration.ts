import { Requirement, registry, ContractHandlerType } from "@m3s/smart-contract";
import { OpenZeppelinAdapter } from "./openzeppelin.adapter";

const openZeppelinRequirements: Requirement[] = [];

registry.registerAdapter('contractHandler', {
  name: 'openZeppelin',
  version: '1.0.0',
  module: 'contractHandler',
  adapterType: ContractHandlerType.openZeppelin,
  adapterClass: OpenZeppelinAdapter,
  requirements: openZeppelinRequirements,
});