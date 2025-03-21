import { createServer } from 'http';
import { join,dirname, extname as _extname } from 'path';
import { existsSync, readFile } from 'fs';
import { fileURLToPath } from "url";

const PORT = process.env.PORT || 8080;
const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '..', 'integration', 'fixtures');

// Create a server for manual testing
const server = createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Set up routing
  let filePath;
  if (req.url === '/') {
    // Show a test menu
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head>
          <title>M3S Integration Tests</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            .test-link { 
              display: block; margin: 10px 0; padding: 15px;
              background: #f0f0f0; border-radius: 5px; text-decoration: none;
              color: #333; font-weight: bold; 
            }
            .test-link:hover { background: #e0e0e0; }
          </style>
        </head>
        <body>
          <h1>M3S Integration Tests</h1>
          <a class="test-link" href="/evmwallet.html">EVM Wallet Test</a>
          <a class="test-link" href="/web3auth.html">Web3Auth Test</a>
        </body>
      </html>
    `);
  } else {
    // Serve requested files from fixtures
    filePath = join(FIXTURES_DIR, req.url);
    
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end(`File not found: ${filePath}`);
      return;
    }
    
    const extname = _extname(filePath).toLowerCase();
    const contentType = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
    }[extname] || 'text/plain';
    
    readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end(`Error reading file: ${err.message}`);
        return;
      }
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  }
});

server.listen(PORT, () => {
  console.log(`Manual test server running at http://localhost:${PORT}`);
  console.log(`- EVM Wallet test: http://localhost:${PORT}/evmwallet.html`);
  console.log(`- Web3Auth test: http://localhost:${PORT}/web3auth.html`);
});