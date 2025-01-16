export async function connectWallet(userMockData: string) {
  console.log(`Conectando al wallet del usuario con el mock: ${userMockData}`);
  return { walletAddress: `0xMockWalletAddress-${userMockData}`, status: "Connected" };
}