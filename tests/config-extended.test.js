import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { validateConfig, generateConfig } from '../src/config.js';

const tempDir = join(process.cwd(), 'tests', 'temp-config-ext');
try { rmSync(tempDir, { recursive: true, force: true }); } catch {}

test('validateConfig accepts batch concurrency', () => {
  const cfg = {
    batch: { concurrency: 5 },
    captures: [{ name: 't', url: 'https://x.com' }],
  };
  assert.doesNotThrow(() => validateConfig(cfg));
});

test('validateConfig rejects invalid batch concurrency', () => {
  const cfg = {
    batch: { concurrency: 0 },
    captures: [{ name: 't', url: 'https://x.com' }],
  };
  assert.throws(() => validateConfig(cfg), /batch\.concurrency/);
});

test('validateConfig rejects non-object defaults', () => {
  assert.throws(() => validateConfig({ defaults: 'string', captures: [] }), /defaults must be an object/);
});

test('validateConfig accepts fullPage, dark, wait with valid types', () => {
  const cfg = {
    captures: [{ name: 't', url: 'https://x.com', fullPage: true, dark: true, wait: 1000 }],
  };
  assert.doesNotThrow(() => validateConfig(cfg));
});

test('validateConfig validates geolocation fields', () => {
  assert.doesNotThrow(() => validateConfig({
    captures: [{ name: 't', url: 'https://x.com', geolocation: { latitude: 40.71, longitude: -74.0 } }],
  }));
});

test('validateConfig rejects geolocation with missing fields', () => {
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 'https://x.com', geolocation: {} }] }),
    /latitude/,
  );
});

test('validateConfig rejects geolocation with non-numeric fields', () => {
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 'https://x.com', geolocation: { latitude: 'a', longitude: 'b' } }] }),
    /numeric/,
  );
});

test('validateConfig rejects geolocation with wrong type', () => {
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 'https://x.com', geolocation: '40,-74' }] }),
    /object/,
  );
});

test('validateConfig rejects invalid colorScheme', () => {
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 'https://x.com', colorScheme: 'blue' }] }),
    /colorScheme/,
  );
});

test('validateConfig accepts all valid colorSchemes', () => {
  for (const scheme of ['light', 'dark', 'no-preference']) {
    assert.doesNotThrow(() => validateConfig({
      captures: [{ name: 't', url: 'https://x.com', colorScheme: scheme }],
    }));
  }
});

test('generateConfig creates valid starter config', () => {
  const result = generateConfig(tempDir);
  assert.equal(result.created, true);
  const loaded = JSON.parse(require('fs').readFileSync(join(tempDir, 'snap-asset.config.json'), 'utf-8'));
  assert.ok(Array.isArray(loaded.captures));
  assert.ok(loaded.defaults);
  assert.equal(loaded.defaults.format, 'both');
});

try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
