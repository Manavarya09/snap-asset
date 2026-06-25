import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { request } from 'node:http';

test('startServer creates a server with close method', async () => {
  const { startServer } = await import('../src/serve.js');
  const { server, close } = await startServer({ port: 0, host: '127.0.0.1' });
  assert.ok(server);
  assert.ok(typeof close === 'function');
  await close();
});

test('/health endpoint returns status ok', async () => {
  const { startServer } = await import('../src/serve.js');
  const { server, close } = await startServer({ port: 0, host: '127.0.0.1' });
  const addr = server.address();
  const res = await new Promise((resolve, _reject) => {
    request(`http://127.0.0.1:${addr.port}/health`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).end();
  });
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.status, 'ok');
  assert.ok(body.version);
  await close();
});

test('unknown route returns 404', async () => {
  const { startServer } = await import('../src/serve.js');
  const { server, close } = await startServer({ port: 0, host: '127.0.0.1' });
  const addr = server.address();
  const res = await new Promise((resolve, _reject) => {
    request(`http://127.0.0.1:${addr.port}/nonexistent`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).end();
  });
  assert.equal(res.status, 404);
  await close();
});

test('close stops the server', async () => {
  const { startServer } = await import('../src/serve.js');
  const { server, close } = await startServer({ port: 0, host: '127.0.0.1' });
  await close();
  const addr = server.address();
  assert.equal(addr, null);
});
