import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createServer } from 'http';
import { sendWebhook } from '../src/webhook.js';

let server;
let port;

test.beforeEach(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const path = req.url;
      if (path === '/ok') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      } else if (path === '/not-found') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
      } else if (path === '/server-error') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal error' }));
      } else if (path === '/timeout') {
        // Never respond
      } else if (path === '/custom-header') {
        const contentType = req.headers['content-type'];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ contentType }));
      }
    });
  });
  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });
});

test.afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('sendWebhook delivers payload to 200 endpoint', async () => {
  const result = await sendWebhook(`http://localhost:${port}/ok`, { test: true });
  const parsed = JSON.parse(result);
  assert.equal(parsed.received, true);
});

test('sendWebhook rejects non-2xx response (404)', async () => {
  await assert.rejects(
    () => sendWebhook(`http://localhost:${port}/not-found`, {}),
    /status 404/,
  );
});

test('sendWebhook rejects non-2xx response (500)', async () => {
  await assert.rejects(
    () => sendWebhook(`http://localhost:${port}/server-error`, {}),
    /status 500/,
  );
});

test('sendWebhook sends custom content-type header', async () => {
  const result = await sendWebhook(`http://localhost:${port}/custom-header`, { test: true }, {
    headers: { 'X-Custom': 'value' },
  });
  assert.ok(result);
});

test('sendWebhook rejects on timeout', async () => {
  await assert.rejects(
    () => sendWebhook(`http://localhost:${port}/timeout`, {}, { timeout: 100 }),
    /timed out/,
  );
});
