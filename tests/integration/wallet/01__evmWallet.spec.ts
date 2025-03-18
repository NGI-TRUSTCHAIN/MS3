import { test, expect, chromium } from '@playwright/test';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Inline setup code
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures');
const port = 8081; // Different port from web3auth test
let server: http.Server;
let browser: any;

// Create server function
async function setupTestEnvironment() {
  // Create a basic server to serve our fixtures
  server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') {
      res.writeHead(204); // No content response
      res.end();
      return;
    }
    

    let filePath = join(fixturesDir, req.url === '/' ? 'index.html' : req.url as string);
  
    if (req.url === '/') {
      filePath = join(fixturesDir, 'evmWallet.html');
    }
    
    if (req.url === '/dist/evmwallet-bundle.js') {
      filePath = join(fixturesDir, 'dist', 'evmwallet-bundle.js');
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
    }[extname] || 'text/plain';

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end(`File not found: ${filePath}`);
      return;
    }
    
    fs.readFile(filePath, (error, content) => {
      if (error) {
        console.error(`Error reading file ${filePath}:`, error);
        res.writeHead(404);
        res.end(`File not found: ${filePath}`);
        return;
      }
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    });
  });

  await new Promise<void>(resolve => server.listen(port, resolve));
  console.log(`Test server running at http://localhost:${port}`);
  
  // Launch browser
  browser = await chromium.launch({ 
    headless: false // Set to true for CI, false for development
  });
  
  return browser;
}

async function teardownTestEnvironment() {
  if (browser) {
    await browser.close();
  }
  if (server) {
    server.close();
  }
}

// Actual test code
test.describe('EVMWallet Integration', () => {
  test.setTimeout(120000); // 2 minute timeout
  const baseUrl = `http://localhost:${port}`;
  
  test.beforeAll(async () => {
    await setupTestEnvironment();
  });

  test.afterAll(async () => {
    await teardownTestEnvironment();
  });

  test('should connect and perform wallet operations', async ({ page }) => {
    // Load the test page
    await page.goto(baseUrl);
    
    // Check initial state
    await expect(page.locator('#wallet-status')).toHaveText('Not connected');
    
    // Connect wallet
    await page.click('#connectButton');
    
    // Wait for successful connection
    await page.waitForSelector('#wallet-status.pass', { timeout: 60000 });
    await expect(page.locator('#walletAddress')).toContainText('0x');
    
    // Test signing message
    await page.click('#signMsgButton');
    await page.waitForSelector('#signature:not(:empty)', { timeout: 30000 });
    const signature = await page.locator('#signature').textContent();
    expect(signature).toBeTruthy();
    
    // Test transaction signing
    await page.click('#signTxButton');
    await page.waitForSelector('#transaction:not(:empty)', { timeout: 30000 });
    const transaction = await page.locator('#transaction').textContent();
    expect(transaction).toBeTruthy();
    
    // Test gas estimation
    await page.click('#estimateGasButton');
    await page.waitForSelector('#gasEstimate:not(:empty)', { timeout: 30000 });
    const gasEstimate = await page.locator('#gasEstimate').textContent();
    expect(gasEstimate).toBeTruthy();
    
    // Test gas price
    await page.click('#getGasPriceButton');
    await page.waitForSelector('#gasPrice:not(:empty)', { timeout: 30000 });
    const gasPrice = await page.locator('#gasPrice').textContent();
    expect(gasPrice).toBeTruthy();
    
    // Test typed data signing
    await page.click('#signTypedDataButton');
    await page.waitForSelector('#typedDataSignature:not(:empty)', { timeout: 30000 });
    const typedDataSignature = await page.locator('#typedDataSignature').textContent();
    expect(typedDataSignature).toBeTruthy();
  });
});