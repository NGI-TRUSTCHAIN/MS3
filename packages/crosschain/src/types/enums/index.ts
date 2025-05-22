export enum ExecutionStatusEnum {
    PENDING = 'PENDING',
    FAILED = 'FAILED',
    DONE = 'DONE',
    ACTION_REQUIRED = 'ACTION_REQUIRED',

    // Not part of the LI.FI API
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
}

export enum CrossChainAdapterType {
  'aggregator' = 'aggregator',
  'bridge' = 'bridge',
  'core' = 'core'
}
