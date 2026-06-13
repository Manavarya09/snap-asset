import { strict as assert } from 'node:assert';
import { test, after } from 'node:test';
import { request } from 'http';
import { startServer } from '../src/serve.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

let serverHandle;

test('startServer and GET /health returns ok', async () => {
  serverHandle = await startServer({ port: 0, host: '127.0.0.1' });
  const addr = serverHandle.server.address();
  const response = await new Promise((resolve, reject) => {
    const req = request(`http://127.0.0.1:${addr.port}/health`, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
  const parsed = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(parsed.status, 'ok');
  assert.equal(parsed.version, pkg.version);
});

after(async () => {
  if (serverHandle) await serverHandle.close();
});
