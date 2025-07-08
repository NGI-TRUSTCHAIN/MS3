/**
 * Defines the standardized names for all capability interfaces across the M3S ecosystem.
 * Using this enum prevents typos and ensures consistency.
 */
export enum Capability {
    // --- Wallet Base Capabilities ---
    CoreWallet = 'ICoreWallet',
    EventEmitter = 'IEventEmitter',
    MessageSigner = 'IMessageSigner',
    TransactionHandler = 'ITransactionHandler',
    TypedDataSigner = 'ITypedDataSigner',
    GasEstimation = 'IGasEstimation',
    TokenOperations = 'ITokenOperations',
    RPCHandler = 'IRPCHandler',
    TransactionStatus = 'ITransactionStatus',

    // --- Smart Contract Capabilities ---
    ContractGenerator = 'IContractGenerator',
    ContractCompiler = 'IContractCompiler',

    // --- Cross-Chain Capabilities ---
    QuoteProvider = 'IQuoteProvider',
    OperationExecutor = 'IOperationExecutor',
    OperationMonitor = 'IOperationMonitor',
    ChainDiscovery = 'IChainDiscovery',
    GasEstimator = 'IGasEstimator',
    OperationMaintenance = 'IOperationMaintenance',

    // --- Common/Base Capabilities ---
    AdapterIdentity = 'IAdapterIdentity',
    AdapterLifecycle = 'IAdapterLifecycle',
}


/**
 * A mapping from method names to the capability interface that provides them.
 * This is used by the capability-aware proxy to check for feature support at runtime.
 * This is the single source of truth for which method belongs to which capability.
 */
export const MethodToCapabilityMap: Record<string, Capability> = {
    // --- ICoreWallet ---
    'getAccounts': Capability.CoreWallet,
    'getBalance': Capability.CoreWallet,
    'getNetwork': Capability.CoreWallet,
    'setProvider': Capability.CoreWallet,
    'disconnect': Capability.CoreWallet,
    'isConnected': Capability.CoreWallet,

    // --- ITransactionHandler ---
    'sendTransaction': Capability.TransactionHandler,

    // --- IMessageSigner ---
    'signMessage': Capability.MessageSigner,

    // --- ITypedDataSigner ---
    'signTypedData': Capability.TypedDataSigner,

    // --- IGasEstimation ---
    'estimateGas': Capability.GasEstimation,

    // --- IEventEmitter ---
    'on': Capability.EventEmitter,
    'off': Capability.EventEmitter,
    'emit': Capability.EventEmitter,

    // --- ITokenOperations ---
    'getTokenBalance': Capability.TokenOperations,
    'addToken': Capability.TokenOperations,
    'watchToken': Capability.TokenOperations,

    // --- IRPCHandler ---
    'getChainId': Capability.RPCHandler,
    'getGasPrice': Capability.RPCHandler,
    'getBlockNumber': Capability.RPCHandler,
    'callContract': Capability.RPCHandler,

    // --- ITransactionStatus ---
    'getTransaction': Capability.TransactionStatus,
    'waitForTransaction': Capability.TransactionStatus,

    // --- IContractGenerator ---
    'generate': Capability.ContractGenerator,

    // --- IContractCompiler ---
    'compile': Capability.ContractCompiler,

    // --- IQuoteProvider ---
    'getOperationQuote': Capability.QuoteProvider,

    // --- IOperationExecutor ---
    'executeOperation': Capability.OperationExecutor,

    // --- IOperationMonitor ---
    'getOperationStatus': Capability.OperationMonitor,
    'cancelOperation': Capability.OperationMonitor,
    'resumeOperation': Capability.OperationMonitor,

    // --- IChainDiscovery ---
    'getSupportedChains': Capability.ChainDiscovery,
    'getSupportedTokens': Capability.ChainDiscovery,

    // --- IGasEstimator ---
    'getGasOnDestination': Capability.GasEstimator,

    // --- IOperationMaintenance ---
    'checkForTimedOutOperations': Capability.OperationMaintenance,

    // --- IAdapterLifecycle ---
    'initialize': Capability.AdapterLifecycle,
    'isInitialized': Capability.AdapterLifecycle,
};