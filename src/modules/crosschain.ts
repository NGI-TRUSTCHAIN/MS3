export async function crossChainTransfer(userMockData: string, amountMockData: number, networkMockData: string) {
  console.log(`Realizando transferencia cruzada de ${amountMockData} desde ${userMockData} a ${networkMockData}`);
  return { success: true, transferDetails: { amount: amountMockData, network: networkMockData, status: "Completed" } };
}
