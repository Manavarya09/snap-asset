import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { safeName, nameFromUrl, resolveOutputPaths } from '../src/output.js';
import { existsSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

const tempDir = join(process.cwd(), 'tests', 'temp-output');

try {
  rmSync(tempDir, { recursive: true, force: true });
} catch {}

assert.ok(!existsSync(tempDir));

test('safeName should sanitize names correctly', () => {
  assert.equal(safeName('Hello World!'), 'hello-world');
  assert.equal(safeName('   Foo___Bar   '), 'foo-bar');
  assert.equal(safeName(''), 'screenshot');
});

test('nameFromUrl should derive names from URLs', () => {
  assert.equal(nameFromUrl('https://example.com'), 'example-com');
  assert.equal(nameFromUrl('https://example.com/foo/bar'), 'foo-bar');
  assert.equal(nameFromUrl('not-a-url'), 'screenshot');
});

test('resolveOutputPaths should create directory and avoid collision', () => {
  const paths1 = resolveOutputPaths(tempDir, 'image', { overwrite: false, format: 'both' });
  assert.equal(paths1.pngPath.endsWith('image.png'), true);
  assert.equal(paths1.webpPath.endsWith('image.webp'), true);
  assert.equal(paths1.avifPath.endsWith('image.avif'), true);

  // Create dummy files to force collision avoidance
  writeFileSync(paths1.pngPath, '');
  writeFileSync(paths1.webpPath, '');
  writeFileSync(paths1.avifPath, '');

  const paths2 = resolveOutputPaths(tempDir, 'image', { overwrite: false, format: 'both' });
  assert.equal(paths2.pngPath.includes('image-1.png'), true);
  assert.equal(paths2.webpPath.includes('image-1.webp'), true);
  assert.equal(paths2.avifPath.includes('image-1.avif'), true);
});
