import { test, expect, chromium } from '@playwright/test';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Inline setup code (instead of importing from setup.js)
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures');
const port = 8080;
let server: http.Server;
let browser: any;

// Create server function
async function setupTestEnvironment() {
  // Create a basic server to serve our fixtures
  server = http.createServer((req, res) => {
    let filePath = join(fixturesDir, req.url === '/' ? 'index.html' : req.url as string);
    
    if (req.url === '/') {
      filePath = join(fixturesDir, 'web3auth.html');
    }
    
    if (req.url === '/dist/bundle.js') {
      filePath = join(fixturesDir, 'dist', 'bundle.js');
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
    }[extname] || 'text/plain';

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
test.describe('Web3Auth Wallet Integration', () => {
  test.setTimeout(300000);

  const baseUrl = `http://localhost:${port}`;
  
  test.beforeAll(async () => {
    await setupTestEnvironment();
  });

  test.afterAll(async () => {
    await teardownTestEnvironment();
  });

  test('should login with Web3Auth', async ({ page }) => {
    // Load the test page
    await page.goto(`${baseUrl}/web3auth.html`);
    
    // Check initial state
    await expect(page.locator('#wallet-status')).toHaveText('Not connected');
    
    // Click login button
    await page.click('#loginButton');
    
    // Wait for popup (can be skipped in headless CI mode)
    const popup = await page.waitForEvent('popup');
    
    // The following steps require Google authentication and can't be easily automated
    // These would be manual steps in development mode:
    // 1. In the popup, select Google account
    // 2. Complete the OAuth flow
    
    // The test will wait here for the OAuth flow to complete manually
    // Once you've manually completed the auth flow, the test will resume
    
    // Wait for connection status to update
    await page.waitForSelector('#wallet-status.pass', { timeout: 0 });
    
    // Verify wallet address is displayed
    await expect(page.locator('#walletAddress')).toContainText('0x');
    
    // Now sign a message
    await page.click('#signButton');
    
    // Verify signature appears
    await page.waitForSelector('#signature:not(:empty)');
    
    // Disconnect
    await page.click('#disconnectButton');
    
    // Verify disconnection
    await expect(page.locator('#wallet-status')).toHaveText('Disconnected');
  });
});