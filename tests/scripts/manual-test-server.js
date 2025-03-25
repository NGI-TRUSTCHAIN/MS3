import { createServer } from 'http';
import { join, extname as _extname } from 'path';
import { existsSync, readFile, readdirSync } from 'fs';
import { fileURLToPath } from "url";

const PORT = process.env.PORT || 8080;
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES_DIR = join(__dirname, '..', 'integration', 'fixtures');

const server = createServer((req, res) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  if (req.url === '/') {
    // Dynamically read all .html files in the fixtures directory
    let files;
    try {
      files = readdirSync(FIXTURES_DIR)
        .filter(file => file.endsWith('.html'));
    } catch (err) {
      res.writeHead(500);
      res.end(`Error reading fixtures directory: ${err.message}`);
      return;
    }
    
    // Generate links for each HTML file
    const links = files.map(file => {
      return `<a class="test-link" href="/${file}">${file.replace('.html', '')} Test</a>`;
    }).join('\n');
    
    const menuHtml = `
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
          ${links}
        </body>
      </html>
    `;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(menuHtml);
    return;
  } else {
    // Serve requested files from fixtures
    const filePath = join(FIXTURES_DIR, req.url);
    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end(`File not found: ${filePath}`);
      return;
    }
    
    const ext = _extname(filePath).toLowerCase();
    const contentType = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json'
    }[ext] || 'text/plain';
    
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
});