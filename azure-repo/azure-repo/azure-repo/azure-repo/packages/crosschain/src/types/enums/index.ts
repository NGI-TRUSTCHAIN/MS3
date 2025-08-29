export enum ExecutionStatusEnum {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    ACTION_REQUIRED = 'ACTION_REQUIRED',
    UNKNOWN = 'UNKNOWN',

    // Not part of the LI.FI API
    IN_PROGRESS = 'IN_PROGRESS',
    DONE = 'DONE',

}

export enum CrossChainAdapterType {
  aggregator = 'aggregator',
  bridge = 'bridge',
  core = 'core'
}
