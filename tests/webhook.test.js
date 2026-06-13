import { strict as assert } from 'node:assert';
import { test, after } from 'node:test';
import { createServer } from 'http';
import { sendWebhook } from '../src/webhook.js';

let server;
let receivedBody;
let receivedHeaders;
const port = 9876;

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

test('sendWebhook sends payload to local server', async () => {
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
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
