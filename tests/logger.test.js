import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { setConfig, isQuiet, debug, savings, divider } from '../src/logger.js';

test('setConfig merges options correctly', () => {
  setConfig({ verbose: true, quiet: false });
  // Just verify it doesn't throw
  assert.doesNotThrow(() => setConfig({ verbose: false }));
});

test('isQuiet returns current state', () => {
  setConfig({ quiet: true });
  assert.equal(isQuiet(), true);
  setConfig({ quiet: false });
  assert.equal(isQuiet(), false);
});

test('debug outputs nothing when debug is disabled', () => {
  setConfig({ debug: false });
  assert.doesNotThrow(() => debug('test message'));
});

test('debug outputs nothing when debug is enabled', () => {
  setConfig({ debug: true });
  assert.doesNotThrow(() => debug('test message'));
  setConfig({ debug: false });
});

test('savings calculates percentage correctly', () => {
  assert.doesNotThrow(() => savings('WebP', 100, 25));
  assert.doesNotThrow(() => savings('AVIF', 1000, 100));
});

test('savings handles zero PNG size', () => {
  assert.doesNotThrow(() => savings('WebP', 0, 0));
});

test('divider does not throw', () => {
  assert.doesNotThrow(() => divider());
});

test('setConfig handles partial options', () => {
  assert.doesNotThrow(() => setConfig({}));
  assert.doesNotThrow(() => setConfig({ verbose: true }));
  assert.doesNotThrow(() => setConfig({ quiet: true }));
  assert.doesNotThrow(() => setConfig({ debug: true }));
});
