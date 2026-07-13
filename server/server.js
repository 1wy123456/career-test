const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const TOKEN_FILE = path.join(__dirname, 'tokens.json');
const PUBLIC_DIR = path.join(__dirname, '..');

// Load tokens from file
function loadTokens() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf8');
}

// Generate a new one-time token
function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

// MIME types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end('Not Found');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // API: Create a new token
  if (pathname === '/api/create-token' && req.method === 'POST') {
    const tokens = loadTokens();
    const token = generateToken();
    tokens[token] = {
      created: Date.now(),
      used: false,
      result: null,
      ip: null,
      userAgent: null,
      completedAt: null
    };
    saveTokens(tokens);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ token, url: `/test.html?token=${token}` }));
    return;
  }

  // API: Validate token
  if (pathname === '/api/validate' && req.method === 'GET') {
    const token = url.searchParams.get('token');
    const tokens = loadTokens();
    if (!token || !tokens[token]) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: false, reason: 'token_not_found' }));
      return;
    }
    const t = tokens[token];
    if (t.used) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: false, reason: 'already_used', completedAt: t.completedAt }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ valid: true }));
    return;
  }

  // API: Mark token as used (when test completes)
  if (pathname === '/api/complete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const token = data.token;
        const result = data.result;
        const tokens = loadTokens();
        if (!token || !tokens[token]) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, reason: 'token_not_found' }));
          return;
        }
        if (tokens[token].used) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, reason: 'already_used' }));
          return;
        }
        tokens[token].used = true;
        tokens[token].result = result;
        tokens[token].completedAt = Date.now();
        saveTokens(tokens);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end('Bad Request');
      }
    });
    return;
  }

  // API: List all tokens (admin)
  if (pathname === '/api/tokens' && req.method === 'GET') {
    const tokens = loadTokens();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(tokens));
    return;
  }

  // Serve test page
  if (pathname === '/test.html' || pathname === '/') {
    serveStatic(res, path.join(PUBLIC_DIR, 'index.html'));
    return;
  }

  // Serve admin page
  if (pathname === '/admin') {
    serveStatic(res, path.join(__dirname, 'admin.html'));
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin page: http://localhost:${PORT}/admin`);
  console.log(`Create token: POST http://localhost:${PORT}/api/create-token`);
});
