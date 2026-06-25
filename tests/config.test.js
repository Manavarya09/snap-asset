import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, validateConfig, generateConfig } from '../src/config.js';

const tempDir = join(process.cwd(), 'tests', 'temp-config');
try {
  rmSync(tempDir, { recursive: true, force: true });
} catch {
  // Directory may not exist yet
}

const configPath = join(tempDir, 'snap-asset.config.json');

test('validateConfig accepts valid configuration', () => {
  const validConfig = {
    defaults: { width: 800, height: 600, format: 'both' },
    captures: [{ name: 'hero', url: 'https://example.com', selector: '.hero' }],
  };
  assert.doesNotThrow(() => validateConfig(validConfig));
});

test('validateConfig accepts single capture without defaults', () => {
  assert.doesNotThrow(() => validateConfig({ captures: [{ name: 'test', url: 'https://x.com' }] }));
});

test('validateConfig rejects null/undefined config', () => {
  assert.throws(() => validateConfig(null), /Invalid configuration format/);
  assert.throws(() => validateConfig(undefined), /Invalid configuration format/);
  assert.throws(() => validateConfig('string'), /Invalid configuration format/);
});

test('validateConfig rejects missing captures array', () => {
  assert.throws(() => validateConfig({}), /captures must be an array/);
  assert.throws(() => validateConfig({ captures: 'not-array' }), /captures must be an array/);
});

test('validateConfig rejects invalid capture entries', () => {
  const invalidConfig = {
    defaults: { width: 800 },
    captures: [{ name: '', url: 'https://example.com' }],
  };
  assert.throws(() => validateConfig(invalidConfig), /capture\[0\]\.name is required/);
});

test('validateConfig rejects capture without url or component', () => {
  assert.throws(
    () => validateConfig({ captures: [{ name: 'test' }] }),
    /capture\[0\] requires either a url or component/,
  );
});

test('validateConfig validates width, height, scale as positive integers', () => {
  assert.throws(() => validateConfig({ captures: [{ name: 't', url: 'https://x.com', width: 0 }] }), /width.*positive/);
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 'https://x.com', height: -1 }] }),
    /height.*positive/,
  );
  assert.throws(() => validateConfig({ captures: [{ name: 't', url: 'https://x.com', scale: 0 }] }), /scale.*positive/);
});

test('validateConfig validates quality range', () => {
  assert.throws(() => validateConfig({ captures: [{ name: 't', url: 'https://x.com', quality: 0 }] }), /quality/);
  assert.throws(() => validateConfig({ captures: [{ name: 't', url: 'https://x.com', quality: 101 }] }), /quality/);
  assert.doesNotThrow(() => validateConfig({ captures: [{ name: 't', url: 'https://x.com', quality: 80 }] }));
});

test('validateConfig validates format', () => {
  assert.throws(() => validateConfig({ captures: [{ name: 't', url: 'https://x.com', format: 'gif' }] }), /format/);
});

test('validateConfig validates resize format', () => {
  assert.throws(() => validateConfig({ captures: [{ name: 't', url: 'https://x.com', resize: 'bad' }] }), /resize/);
});

test('validateConfig rejects invalid scale (0, negative, non-integer)', () => {
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 'https://x.com', scale: 0 }] }),
    /scale.*positive/,
  );
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 'https://x.com', scale: -1 }] }),
    /scale.*positive/,
  );
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 'https://x.com', scale: 1.5 }] }),
    /scale.*positive/,
  );
  assert.doesNotThrow(() => validateConfig({ captures: [{ name: 't', url: 'https://x.com', scale: 1 }] }));
  assert.doesNotThrow(() => validateConfig({ captures: [{ name: 't', url: 'https://x.com', scale: 2 }] }));
});

test('validateConfig rejects invalid quality (0, 101, string)', () => {
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 'https://x.com', quality: 0 }] }),
    /quality/,
  );
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 'https://x.com', quality: 101 }] }),
    /quality/,
  );
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 'https://x.com', quality: 'high' }] }),
    /quality/,
  );
  assert.doesNotThrow(() => validateConfig({ captures: [{ name: 't', url: 'https://x.com', quality: 1 }] }));
  assert.doesNotThrow(() => validateConfig({ captures: [{ name: 't', url: 'https://x.com', quality: 100 }] }));
});

test('validateConfig rejects invalid format with wrong case', () => {
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 'https://x.com', format: 'PNG' }] }),
    /format/,
  );
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 'https://x.com', format: 'WebP' }] }),
    /format/,
  );
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 'https://x.com', format: 'AVIF' }] }),
    /format/,
  );
});

test('validateConfig accepts component-only captures', () => {
  assert.doesNotThrow(() => validateConfig({ captures: [{ name: 'btn', component: './src/Button.tsx' }] }));
  assert.doesNotThrow(() => validateConfig({ captures: [{ name: 'card', component: 'src/Card.svelte' }] }));
});

test('validateConfig rejects captures with invalid types for url/component/selector', () => {
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 123 }] }),
    /url must be a string/,
  );
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', component: 456 }] }),
    /component must be a string/,
  );
  assert.throws(
    () => validateConfig({ captures: [{ name: 't', url: 'https://x.com', selector: true }] }),
    /selector must be a string/,
  );
});

test('loadConfig returns null for empty directory', () => {
  const emptyDir = join(process.cwd(), 'tests', 'temp-config-empty');
  mkdirSync(emptyDir, { recursive: true });
  const result = loadConfig(emptyDir);
  assert.equal(result, null);
  rmSync(emptyDir, { recursive: true, force: true });
});

test('validateConfig validates component path', () => {
  assert.doesNotThrow(() => validateConfig({ captures: [{ name: 't', component: './src/Button.tsx' }] }));
});

test('loadConfig returns null for missing config file', () => {
  assert.equal(loadConfig('/nonexistent/path'), null);
});

test('loadConfig merges defaults and captures correctly', () => {
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(
    configPath,
    JSON.stringify(
      {
        defaults: { width: 900, height: 700, format: 'webp' },
        captures: [{ name: 'hero', url: 'https://example.com', selector: '.hero' }],
      },
      null,
      2,
    ),
  );

  const loaded = loadConfig(tempDir);

  assert.equal(loaded.captures.length, 1);
  assert.equal(loaded.captures[0].width, 900);
  assert.equal(loaded.captures[0].format, 'webp');
  assert.equal(loaded.captures[0].name, 'hero');
});

test('generateConfig creates starter config file', () => {
  rmSync(tempDir, { recursive: true, force: true });
  const result = generateConfig(tempDir);
  assert.equal(result.created, true);

  const loaded = loadConfig(tempDir);
  assert.ok(loaded.captures.length > 0);
});

test('generateConfig returns not-created if config exists', () => {
  const result = generateConfig(tempDir);
  assert.equal(result.created, false);
});

try {
  rmSync(tempDir, { recursive: true, force: true });
} catch {
  // Directory may not exist
}
