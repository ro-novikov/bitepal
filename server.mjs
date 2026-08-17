import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { processMotivationRequest } from './lib/motivation.mjs';

dotenv.config();

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let path = req.url.split('?')[0];
  if (path === '/') path = '/04/';

  let filePath = join(__dirname, path);
  if (path.endsWith('/')) filePath = join(filePath, 'index.html');

  if (!filePath.startsWith(__dirname) || !existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(readFileSync(filePath));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/motivation') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw.toString());
      const result = await processMotivationRequest(body);
      sendJson(res, 200, result);
    } catch (err) {
      console.error(err);
      const status = err.message.includes('Missing') || err.message.includes('transcribe') ? 400 : 500;
      sendJson(res, status, { error: err.message || 'Something went wrong' });
    }
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`BitePal demo running at http://localhost:${PORT}/04/`);
  if (!process.env.OPENAI_API_KEY) console.warn('Warning: OPENAI_API_KEY missing in .env');
});
