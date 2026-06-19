import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { rmSync } from 'fs';
import { join } from 'path';
import DiskCache from '../src/cache.js';

const cacheRoot = join(process.cwd(), 'tests', 'temp-cache-ext');
try { rmSync(cacheRoot, { recursive: true, force: true }); } catch { /* cleanup */ }

test('DiskCache stores and retrieves large data', async () => {
  const cache = new DiskCache(cacheRoot);
  const largeData = Buffer.alloc(1024 * 100, 'x'); // 100KB
  await cache.set('large-key', largeData);
  const result = await cache.get('large-key');
  assert.ok(Buffer.isBuffer(result));
  assert.equal(result.length, 1024 * 100);
});

test('DiskCache.clear removes all entries', async () => {
  const cache = new DiskCache(cacheRoot);
  await cache.set('clear-key1', Buffer.from('data1'));
  await cache.set('clear-key2', Buffer.from('data2'));
  await cache.clear();
  assert.equal(await cache.get('clear-key1'), null);
  assert.equal(await cache.get('clear-key2'), null);
});

test('DiskCache handles overwriting existing key', async () => {
  const cache = new DiskCache(cacheRoot);
  await cache.set('overwrite-key', Buffer.from('old'));
  await cache.set('overwrite-key', Buffer.from('new'));
  const result = await cache.get('overwrite-key');
  assert.equal(result.toString(), 'new');
});

test('DiskCache.get returns null after cache is cleared', async () => {
  const cache = new DiskCache(cacheRoot);
  await cache.set('ephemeral', Buffer.from('temp'));
  await cache.clear();
  assert.equal(await cache.get('ephemeral'), null);
});

test('DiskCache handles sequential set and get on same key', async () => {
  const cache = new DiskCache(cacheRoot);
  for (let i = 0; i < 10; i++) {
    await cache.set(`seq-key-${i}`, Buffer.from(`data-${i}`));
  }
  for (let i = 0; i < 10; i++) {
    const result = await cache.get(`seq-key-${i}`);
    assert.notEqual(result, null);
    assert.equal(result.toString(), `data-${i}`);
  }
});

try { rmSync(cacheRoot, { recursive: true, force: true }); } catch { /* cleanup */ }
