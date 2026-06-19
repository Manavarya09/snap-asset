import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PluginManager } from '../src/plugin.js';

test('PluginManager prevents registration without name', () => {
  const pm = new PluginManager();
  assert.throws(() => pm.registerPlugin({}), /Plugin must have a name/);
  assert.throws(() => pm.registerPlugin(null), /Plugin must have a name/);
  assert.throws(() => pm.registerPlugin(undefined), /Plugin must have a name/);
});

test('PluginManager.applyHook chains multiple plugins', async () => {
  const pm = new PluginManager();
  pm.registerPlugin({
    name: 'add-foo',
    hooks: {
      'pre:capture': async (ctx) => ({ ...ctx, foo: 'bar' }),
    },
  });
  pm.registerPlugin({
    name: 'add-baz',
    hooks: {
      'pre:capture': async (ctx) => ({ ...ctx, baz: 'qux' }),
    },
  });
  const result = await pm.applyHook('pre:capture', { initial: true });
  assert.equal(result.foo, 'bar');
  assert.equal(result.baz, 'qux');
  assert.equal(result.initial, true);
});

test('PluginManager.applyHook returns context unchanged when no hooks match', async () => {
  const pm = new PluginManager();
  pm.registerPlugin({
    name: 'empty',
    hooks: {},
  });
  const result = await pm.applyHook('pre:capture', { key: 'value' });
  assert.equal(result.key, 'value');
});

test('PluginManager.applyHook skips missing hooks gracefully', async () => {
  const pm = new PluginManager();
  pm.registerPlugin({
    name: 'no-hooks',
  });
  const result = await pm.applyHook('post:capture', { key: 'value' });
  assert.equal(result.key, 'value');
});

test('PluginManager.applyHook handles plugin without hooks property', async () => {
  const pm = new PluginManager();
  pm.registerPlugin({ name: 'minimal' });
  const result = await pm.applyHook('any', {});
  assert.deepEqual(result, {});
});

test('PluginManager.registerPlugin accepts multiple plugins', () => {
  const pm = new PluginManager();
  pm.registerPlugin({ name: 'a', hooks: {} });
  pm.registerPlugin({ name: 'b', hooks: {} });
  pm.registerPlugin({ name: 'c', hooks: {} });
  // No assertion needed — just verify no throw
  assert.ok(pm instanceof PluginManager);
});
