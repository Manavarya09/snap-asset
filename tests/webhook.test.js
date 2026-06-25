import { strict as assert } from 'node:assert';
import { test, before, after } from 'node:test';
import { createServer } from 'node:http';
import { sendWebhook } from '../src/webhook.js';

let server;
let port;
let receivedBody;
let receivedHeaders;

before(async () => {
  await new Promise((resolve) => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        receivedBody = body;
        receivedHeaders = req.headers;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });
});

test('sendWebhook sends payload to local server', async () => {
  const payload = { message: 'hello' };
  const response = await sendWebhook(`http://127.0.0.1:${port}`, payload);
  assert.equal(receivedBody, JSON.stringify(payload));
  assert.equal(JSON.parse(response).ok, true);
});

test('sendWebhook sends custom headers', async () => {
  const payload = { msg: 'custom headers' };
  const response = await sendWebhook(`http://127.0.0.1:${port}`, payload, {
    headers: { 'X-Custom': 'test-value' },
  });
  assert.equal(receivedHeaders['x-custom'], 'test-value');
  assert.equal(JSON.parse(response).ok, true);
});

test('sendWebhook rejects on timeout', async () => {
  await assert.rejects(
    () => sendWebhook('http://192.0.2.1', {}, { timeout: 50 }),
    { message: /timed out/ },
  );
});

after(() => {
  server.close();
});
