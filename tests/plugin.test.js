import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PluginManager } from '../src/plugin.js';

test('PluginManager can be instantiated', () => {
  const pm = new PluginManager();
  assert.ok(pm instanceof PluginManager);
  assert.deepEqual(pm.plugins, []);
});

test('registerPlugin adds a plugin', () => {
  const pm = new PluginManager();
  pm.registerPlugin({ name: 'test-plugin', hooks: {} });
  assert.equal(pm.plugins.length, 1);
  assert.equal(pm.plugins[0].name, 'test-plugin');
});

test('registerPlugin throws without name', () => {
  const pm = new PluginManager();
  assert.throws(() => pm.registerPlugin({}), { message: 'Plugin must have a name' });
  assert.throws(() => pm.registerPlugin(), { message: 'Plugin must have a name' });
});

test('applyHook passes context through and returns it', async () => {
  const pm = new PluginManager();
  pm.registerPlugin({
    name: 'plugin-a',
    hooks: {
      'pre:capture': async (ctx) => ({ ...ctx, fromA: true }),
    },
  });
  const result = await pm.applyHook('pre:capture', { url: 'https://example.com' });
  assert.equal(result.url, 'https://example.com');
  assert.equal(result.fromA, true);
});

test('applyHook chains multiple plugins', async () => {
  const pm = new PluginManager();
  pm.registerPlugin({
    name: 'plugin-a',
    hooks: {
      'pre:capture': async (ctx) => ({ ...ctx, step: 1 }),
    },
  });
  pm.registerPlugin({
    name: 'plugin-b',
    hooks: {
      'pre:capture': async (ctx) => ({ ...ctx, step: ctx.step + 1 }),
    },
  });
  const result = await pm.applyHook('pre:capture', {});
  assert.equal(result.step, 2);
});

test('applyHook with no registered hooks returns context unchanged', async () => {
  const pm = new PluginManager();
  const result = await pm.applyHook('pre:capture', { url: 'https://example.com' });
  assert.deepEqual(result, { url: 'https://example.com' });
});

test('applyHook with no matching hook returns context unchanged', async () => {
  const pm = new PluginManager();
  pm.registerPlugin({ name: 'p', hooks: { 'post:capture': async (ctx) => ctx } });
  const result = await pm.applyHook('pre:capture', { key: 'val' });
  assert.deepEqual(result, { key: 'val' });
});
