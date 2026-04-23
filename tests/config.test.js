import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { loadConfig, validateConfig } from '../src/config.js';

const tempDir = join(process.cwd(), 'tests', 'temp-config');
try {
  rmSync(tempDir, { recursive: true, force: true });
} catch {}

const configPath = join(tempDir, 'snap-asset.config.json');

try {
  test('validateConfig accepts valid configuration', () => {
    const validConfig = {
      defaults: { width: 800, height: 600, format: 'both' },
      captures: [
        { name: 'hero', url: 'https://example.com', selector: '.hero' },
      ],
    };
    assert.doesNotThrow(() => validateConfig(validConfig));
  });

  test('validateConfig rejects invalid capture entries', () => {
    const invalidConfig = {
      defaults: { width: 800 },
      captures: [
        { name: '', url: 'https://example.com' },
      ],
    };
    assert.throws(() => validateConfig(invalidConfig), /capture\[0\]\.name is required/);
  });

  test('loadConfig merges defaults and captures correctly', () => {
    writeFileSync(configPath, JSON.stringify({
      defaults: { width: 900, height: 700, format: 'webp' },
      captures: [
        { name: 'hero', url: 'https://example.com', selector: '.hero' },
      ],
    }, null, 2));

    const loaded = loadConfig(tempDir);

    assert.equal(loaded.captures.length, 1);
    assert.equal(loaded.captures[0].width, 900);
    assert.equal(loaded.captures[0].format, 'webp');
  });
} finally {
  try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
}
