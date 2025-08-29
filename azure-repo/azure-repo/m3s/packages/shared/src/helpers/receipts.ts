import type { Provider, TransactionReceipt } from 'ethers';

/** Wait for a transaction receipt. */
export async function waitForReceipt(
  provider: Provider | any,
  txHash: string,
  timeout = 180_000, // null = wait indefinitely
  pollInterval = 1000,
  options?: { signal?: AbortSignal; onPoll?: (attempt: number) => void }
): Promise<TransactionReceipt | null> {
  if (!provider) throw new Error('Provider required');
  if (!txHash) throw new Error('txHash required');

  const { signal, onPoll } = options || {};
  if (signal?.aborted) return null;

  if (typeof provider.waitForTransaction === 'function') {
    try {
      const waitTimeout = timeout === null ? undefined : timeout;
      return await provider.waitForTransaction(txHash, undefined, waitTimeout);
    } catch (err) {
      // fallback to polling
      // eslint-disable-next-line no-console
      console.debug('[waitForReceipt] waitForTransaction failed, falling back to polling:', (err as any)?.message ?? err);
    }
  }

  const start = Date.now();
  let attempt = 0;
  while (true) {
    if (signal?.aborted) return null;

    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) return receipt;
    } catch {
      // ignore RPC errors
    }

    attempt++;
    if (onPoll) {
      try { onPoll(attempt); } catch { /* ignore */ }
    }

    if (timeout !== null && Date.now() - start >= timeout) return null;
    await new Promise((r) => setTimeout(r, pollInterval));
  }
}