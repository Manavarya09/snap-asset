import { createServer } from 'http';
import { captureUrl } from './capturer.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

function isPrivateHost(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
  if (/^10\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^169\.254\./.test(hostname)) return true;
  if (/^\[?fd[0-9a-f]{2}:/.test(hostname)) return true;
  return false;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const VERSION = pkg.version;

let htmlFormCache = null;
function getHtmlForm() {
  if (htmlFormCache) return htmlFormCache;
  const htmlPath = join(__dirname, '..', 'website', 'index.html');
  if (existsSync(htmlPath)) {
    htmlFormCache = readFileSync(htmlPath, 'utf-8');
  } else {
    htmlFormCache = '<!DOCTYPE html><html><body><h1>snap-asset</h1><p>UI not found. Install with: npm run build</p></body></html>';
  }
  return htmlFormCache;
}

export async function startServer(options = {}) {
  const port = options.port || 3000;
  const host = options.host || '0.0.0.0';

  const server = createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(getHtmlForm());
        return;
      }

      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', version: VERSION }));
        return;
      }

      if (req.method === 'POST' && req.url === '/capture') {
        let body = '';
        const MAX_BODY_SIZE = 1024 * 100; // 100KB
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > MAX_BODY_SIZE) {
            req.destroy(new Error('Request body too large'));
          }
        });
        await new Promise((resolve, reject) => {
          req.on('end', resolve);
          req.on('error', reject);
        });
        let parsedBody;
        try {
          parsedBody = JSON.parse(body);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
          return;
        }

        const { url, format, options: captureOpts } = parsedBody;

        if (!url) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'url is required' }));
          return;
        }

        let parsedCaptureUrl;
        try {
          parsedCaptureUrl = new URL(url);
          if (isPrivateHost(parsedCaptureUrl.hostname)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Access to private/internal network addresses is not allowed' }));
            return;
          }
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid URL format' }));
          return;
        }

        const result = await captureUrl(url, captureOpts || {});
        const outputBuffer = result.pdf || result.buffer;

        if (!outputBuffer) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No capture result returned' }));
          return;
        }

        const formatMap = { png: 'image/png', webp: 'image/webp', avif: 'image/avif', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
        const contentType = result.pdf ? 'application/pdf' : (formatMap[format] || 'image/png');

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(outputBuffer);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  await new Promise((resolve) => server.listen(port, host, resolve));

  return {
    server,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
