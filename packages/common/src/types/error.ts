// Keep the existing WalletErrorCode
export enum WalletErrorCode {
    Unknown = 'UNKNOWN',
    environment = 'ENVIRONMENT_MISMATCH',
    NotImplemented = 'NOT_IMPLEMENTED',
    AdapterNotInitialized = 'ADAPTER_NOT_INITIALIZED',
    WalletNotConnected = 'WALLET_NOT_CONNECTED',
    ProviderNotFound = 'PROVIDER_NOT_FOUND',
    NetworkError = 'NETWORK_ERROR',
    UserRejected = 'USER_REJECTED', // Common for transaction/signature denials
    InvalidInput = 'INVALID_INPUT',
    TransactionFailed = 'TRANSACTION_FAILED',
    SignatureFailed = 'SIGNATURE_FAILED',
    MethodNotSupported = 'METHOD_NOT_SUPPORTED',
    FeatureNotSupported = 'FEATURE_NOT_SUPPORTED', // Added based on createWallet
    AdapterNotFound = 'ADAPTER_NOT_FOUND',     // Added based on createWallet
    MissingConfig = 'MISSING_CONFIG', // For missing essential configuration
    InitializationFailed = 'INITIALIZATION_FAILED', // For failures during adapter.initialize()
    ConnectionFailed = 'CONNECTION_FAILED', // For failures in setProvider or connecting to RPC
    AccountUnavailable = 'ACCOUNT_UNAVAILABLE', // When an account is needed but not found/derived
    GasEstimationFailed = 'GAS_ESTIMATION_FAILED',
    InsufficientFunds = 'INSUFFICIENT_FUNDS',
    TransactionReceiptFailed = 'TRANSACTION_RECEIPT_FAILED',
    TokenBalanceFailed = 'TOKEN_BALANCE_FAILED',
    SigningFailed = 'INVALID_SIGNATURE',
    ContractCallFailed = 'CONTRACT CALL FAILED'
}

// Define CrossChain Error Codes
export enum CrossChainErrorCode {
    Unknown = 'CC_UNKNOWN',
    AdapterNotInitialized = 'CC_ADAPTER_NOT_INITIALIZED',
    NetworkError = 'CC_NETWORK_ERROR',
    InvalidInput = 'CC_INVALID_INPUT',
    QuoteFailed = 'CC_QUOTE_FAILED',
    ExecutionFailed = 'CC_EXECUTION_FAILED',
    ProviderSetFailed = 'CC_PROVIDER_SETUP_FAILED',
    StatusCheckFailed = 'CC_STATUS_CHECK_FAILED',
    UnsupportedChain = 'CC_UNSUPPORTED_CHAIN',
    UnsupportedToken = 'CC_UNSUPPORTED_TOKEN',
    OperationNotFound = 'CC_OPERATION_NOT_FOUND',
    // Add more specific codes as needed
}

// Define SmartContract Error Codes
export enum SmartContractErrorCode {
    Unknown = 'SC_UNKNOWN',
    AdapterNotInitialized = 'SC_ADAPTER_NOT_INITIALIZED',
    NetworkError = 'SC_NETWORK_ERROR',
    InvalidInput = 'SC_INVALID_INPUT',
    CompilationFailed = 'SC_COMPILATION_FAILED',
    DeploymentFailed = 'SC_DEPLOYMENT_FAILED',
    MethodCallFailed = 'SC_METHOD_CALL_FAILED', // Generic call failure
    ReadCallFailed = 'SC_READ_CALL_FAILED',   // Specific read failure
    WriteCallFailed = 'SC_WRITE_CALL_FAILED',  // Specific write failure
    InvalidAbi = 'SC_INVALID_ABI',
    ContractNotFound = 'SC_CONTRACT_NOT_FOUND',
    WalletRequired = 'SC_WALLET_REQUIRED', // For write operations
    // Add more specific codes as needed
}

// Union type for convenience if needed elsewhere
export type M3SAdapterErrorCode = WalletErrorCode | CrossChainErrorCode | SmartContractErrorCode | string;
