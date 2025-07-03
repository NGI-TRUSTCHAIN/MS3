import { Provider } from 'ethers';
import { GenericTransactionData } from '../types/index.js';

export class SimpleGasEstimator {
  
  // ✅ Simple transaction complexity detection
  private static getTransactionComplexity(tx: GenericTransactionData): {
    baseGas: bigint;
    isDeployment: boolean;
    isComplex: boolean;
  } {
    // Contract deployment
    if (!tx.to) {
      const isProxyLike = tx.data && tx.data.length > 20000;
      return {
        baseGas: isProxyLike ? BigInt(4000000) : BigInt(2000000),
        isDeployment: true,
        isComplex: true
      };
    }

    // Simple transfer
    if (!tx.data || tx.data === '0x') {
      return {
        baseGas: BigInt(21000),
        isDeployment: false,
        isComplex: false
      };
    }

    // Contract interaction complexity based on data size
    const dataLength = tx.data.length;
    if (dataLength > 5000) {
      return {
        baseGas: BigInt(500000),
        isDeployment: false,
        isComplex: true
      };
    } else if (dataLength > 1000) {
      return {
        baseGas: BigInt(200000),
        isDeployment: false,
        isComplex: true
      };
    } else {
      return {
        baseGas: BigInt(100000),
        isDeployment: false,
        isComplex: false
      };
    }
  }

  // ✅ Dynamic gas limit estimation
  public static async estimateGasLimit(
    tx: GenericTransactionData,
    provider: Provider,
    fromAddress?: string
  ): Promise<bigint> {
    const complexity = this.getTransactionComplexity(tx);

    // Try network estimation first
    try {
      const estimateRequest: any = {
        to: tx.to,
        value: tx.value ? BigInt(tx.value) : undefined,
        data: tx.data,
      };

      if (fromAddress) {
        estimateRequest.from = fromAddress;
      }

      const networkEstimate = await provider.estimateGas(estimateRequest);
      
      // Apply buffer: 15% for simple, 25% for complex transactions
      const bufferMultiplier = complexity.isComplex ? 125 : 115;
      const bufferedEstimate = networkEstimate * BigInt(bufferMultiplier) / BigInt(100);

      console.log(`[SimpleGasEstimator] Network estimate: ${networkEstimate}, buffered: ${bufferedEstimate}`);
      return bufferedEstimate;

    } catch (error: any) {
      console.warn(`[SimpleGasEstimator] Network estimation failed: ${error.message}, using fallback`);
      
      // Use complexity-based fallback
      return complexity.baseGas;
    }
  }

  // ✅ Dynamic fee estimation with network awareness
  public static async estimateFees(provider: Provider): Promise<{
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
  }> {
    try {
      const feeData = await provider.getFeeData();
      const network = await provider.getNetwork();
      
      // Check if this is a testnet (heuristic: chainId > 1000 usually indicates testnet)
      const isTestnet = Number(network.chainId) > 1000;
      
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        // EIP-1559 network
        const baseFee = feeData.maxFeePerGas - feeData.maxPriorityFeePerGas;
        
        // Use conservative multipliers for testnets, moderate for mainnet
        const priorityMultiplier = isTestnet ? 50 : 75; // 50% or 75% of suggested priority
        const maxFeeMultiplier = isTestnet ? 80 : 90;   // 80% or 90% of suggested max fee
        
        const optimizedPriority = feeData.maxPriorityFeePerGas * BigInt(priorityMultiplier) / BigInt(100);
        const optimizedMaxFee = (baseFee + optimizedPriority) * BigInt(maxFeeMultiplier) / BigInt(100);
        
        // Simple minimum thresholds (very basic, not hardcoded per network)
        const minPriority = isTestnet ? BigInt('100000000') : BigInt('1000000000'); // 0.1 or 1 gwei
        const minMaxFee = isTestnet ? BigInt('200000000') : BigInt('2000000000');   // 0.2 or 2 gwei
        
        return {
          maxFeePerGas: optimizedMaxFee < minMaxFee ? minMaxFee : optimizedMaxFee,
          maxPriorityFeePerGas: optimizedPriority < minPriority ? minPriority : optimizedPriority
        };
        
      } else if (feeData.gasPrice) {
        // Legacy network
        const multiplier = isTestnet ? 80 : 90; // Slightly lower for testnets
        const optimizedGasPrice = feeData.gasPrice * BigInt(multiplier) / BigInt(100);
        
        const minGasPrice = isTestnet ? BigInt('100000000') : BigInt('1000000000'); // 0.1 or 1 gwei
        
        return {
          gasPrice: optimizedGasPrice < minGasPrice ? minGasPrice : optimizedGasPrice
        };
      }
    } catch (error: any) {
      console.warn(`[SimpleGasEstimator] Fee estimation failed: ${error.message}`);
    }

    // Ultimate fallback - let the network decide
    return {};
  }

  // ✅ All-in-one estimation method
  public static async estimate(
    tx: GenericTransactionData,
    provider: Provider,
    fromAddress?: string
  ): Promise<{
    gasLimit: bigint;
    gasPrice?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
  }> {
    const [gasLimit, fees] = await Promise.all([
      this.estimateGasLimit(tx, provider, fromAddress),
      this.estimateFees(provider)
    ]);

    return {
      gasLimit,
      ...fees
    };
  }
}