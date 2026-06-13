import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { rmSync } from 'fs';
import { join } from 'path';
import DiskCache from '../src/cache.js';

const cacheRoot = join(process.cwd(), 'tests', 'temp-cache');
try {
  rmSync(cacheRoot, { recursive: true, force: true });
} catch {
  // Directory may not exist yet
}

test('DiskCache can be instantiated', () => {
  const cache = new DiskCache(cacheRoot);
  assert.ok(cache instanceof DiskCache);
  assert.equal(cache.root, cacheRoot);
  assert.equal(cache.maxEntries, 200);
  assert.equal(cache.defaultTTL, 3600);
});

test('set and get round trip', async () => {
  const cache = new DiskCache(cacheRoot);
  const data = Buffer.from('hello cache');
  await cache.set('test-key', data);
  const result = await cache.get('test-key');
  assert.ok(Buffer.isBuffer(result));
  assert.equal(result.toString(), 'hello cache');
});

test('get returns null for missing key', async () => {
  const cache = new DiskCache(cacheRoot);
  const result = await cache.get('nonexistent-key');
  assert.equal(result, null);
});

test('cache eviction when maxEntries exceeded', async () => {
  const cache = new DiskCache(cacheRoot, { maxEntries: 3 });
  await cache.set('key1', Buffer.from('data1'));
  await new Promise((r) => setTimeout(r, 5));
  await cache.set('key2', Buffer.from('data2'));
  await new Promise((r) => setTimeout(r, 5));
  await cache.set('key3', Buffer.from('data3'));
  // Access key1 to update its lastAccess timestamp
  await cache.get('key1');
  await new Promise((r) => setTimeout(r, 5));
  // Add 4th entry - should evict least recently used (key2)
  await cache.set('key4', Buffer.from('data4'));
  assert.equal(await cache.get('key2'), null);
  assert.ok(await cache.get('key1') !== null);
  assert.ok(await cache.get('key3') !== null);
  assert.ok(await cache.get('key4') !== null);
});

test('TTL expiration', async () => {
  const cache = new DiskCache(cacheRoot);
  await cache.set('ttl-key', Buffer.from('ttl data'), { ttl: 0.01 });
  await new Promise((r) => setTimeout(r, 50));
  const result = await cache.get('ttl-key');
  assert.equal(result, null);
});

try {
  rmSync(cacheRoot, { recursive: true, force: true });
} catch {
  // Directory may not exist yet
}
