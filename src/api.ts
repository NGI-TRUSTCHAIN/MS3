import express from 'express';
import { connectWallet } from './modules/wallet';
import { deployContract, interactWithContract } from './modules/smartContract';
import { crossChainTransfer } from './modules/crosschain';

const app = express();
const port = 3000;

app.get('/connect-wallet', async (req, res) => {
  const userMockData = 'user123';
  const result = await connectWallet(userMockData);
  res.json(result);
});

app.get('/deploy-contract', async (req, res) => {
  const userMockData = 'user123';
  const paramsMockData = 'tokenContractParam';
  const result = await deployContract(userMockData, paramsMockData);
  res.json(result);
});

app.get('/interact-contract', async (req, res) => {
  const userMockData = 'user123';
  const contractAddress = '0xMockContractAddress-token';
  const result = await interactWithContract(contractAddress, userMockData);
  res.json(result);
});

app.get('/crosschain-transfer', async (req, res) => {
  const userMockData = 'user123';
  const amountMockData = 100;
  const networkMockData = 'EthereumToBinance';
  const result = await crossChainTransfer(userMockData, amountMockData, networkMockData);
  res.json(result);
});

app.listen(port, () => {
  console.log(`API corriendo en http://localhost:${port}`);
});

// Exportas todo lo que necesitas hacer disponible para el consumidor de tu paquete
export { connectWallet, deployContract, interactWithContract, crossChainTransfer };