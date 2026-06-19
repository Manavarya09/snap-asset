import { createServer } from 'http';
import { captureUrl } from './capturer.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const HTML_FORM = readFileSync(join(__dirname, '..', 'website', 'index.html'), 'utf-8');
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const VERSION = pkg.version;

export async function startServer(options = {}) {
  const port = options.port || 3000;
  const host = options.host || '0.0.0.0';

  const server = createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(HTML_FORM);
        return;
      }

      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', version: VERSION }));
        return;
      }

      if (req.method === 'POST' && req.url === '/capture') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        await new Promise((resolve) => req.on('end', resolve));
        const { url, format, options: captureOpts } = JSON.parse(body);

        if (!url) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'url is required' }));
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
