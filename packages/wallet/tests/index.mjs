import { Wallet } from '@m3s/wallet';

async function test() {
  const wallet = new Wallet('mockedAdapter');
  const provider = 'https://sepolia.infura.io/v3/97851b45f6a6423593cbc26793a738a8';
  wallet.setProvider(provider);

  try {
    // Metadata
    console.log('=== Metadata Tests ===');
    console.log('Wallet name:', await wallet.getWalletName());
    console.log('Wallet version:', await wallet.getWalletVersion());
    console.log('Connected:', wallet.isConnected());

    // Account Management
    console.log('\n=== Account Management Tests ===');
    console.log('Request accounts:', await wallet.requestAccounts());
    console.log('Get accounts:', await wallet.getAccounts());
    
    // Event Handlers
    console.log('\n=== Event Handler Tests ===');
    const testCallback = (...args) => console.log('Event received:', args);
    wallet.on('accountsChanged', testCallback);
    wallet.off('accountsChanged', testCallback);
    
    // Network Management
    console.log('\n=== Network Management Tests ===');
    console.log('Network:', await wallet.getNetwork());
    console.log('Switch network:', await wallet.switchNetwork('0x5')); // Goerli testnet
    
    // Transaction & Signing
    console.log('\n=== Transaction & Signing Tests ===');
    const tx = {
      to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      value: '0.001',
      data: '0x'
    };
    
    console.log('Sign transaction:', await wallet.signTransaction(tx));
    console.log('Send transaction:', await wallet.sendTransaction(tx));
    console.log('Sign message:', await wallet.signMessage('Hello Web3!'));

  } catch (error) {
    console.error('Test failed:', error);
  }
}

test().catch(console.error);