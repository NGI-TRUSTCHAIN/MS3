import { JsonRpcProvider } from "ethers";

/**
 * Returns the proper object to pass to setProvider based on the adapter type.
 * This hides adapter‐specific if logic from your test template.
 *
 * @param wallet The active wallet adapter instance.
 * @param chainConfig The network configuration object.
 * @returns An object either { rpc: Provider } or { chainConfig: chainConfig }.
 */
  async function getProviderParamForAdapter(
  wallet,
  chainConfig
){
  const name = wallet.getWalletName().toLowerCase();
  if (name.includes("web3auth")) {
    // Web3Auth adapter accepts a configuration object with a chainConfig property.
    return { chainConfig };
  } else {
    // EVM wallet adapter accepts a provider wrapped under 'rpc'
    const newProvider = new JsonRpcProvider(chainConfig.rpcTarget);
    await newProvider.ready;
    return { rpc: newProvider };
  }
}

export {getProviderParamForAdapter}