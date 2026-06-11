import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { safeName, nameFromUrl, nameFromComponent, resolveOutputPaths, detectOutputDir } from '../src/output.js';
import { existsSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

const tempDir = join(process.cwd(), 'tests', 'temp-output');

try {
  rmSync(tempDir, { recursive: true, force: true });
} catch {
  // Directory may not exist yet
}

assert.ok(!existsSync(tempDir));

test('safeName should sanitize names correctly', () => {
  assert.equal(safeName('Hello World!'), 'hello-world');
  assert.equal(safeName('   Foo___Bar   '), 'foo-bar');
  assert.equal(safeName(''), 'screenshot');
  assert.equal(safeName('  '), 'screenshot');
  assert.equal(safeName('SPECIAL_Chars-123'), 'special-chars-123');
  assert.equal(safeName('UPPERCASE'), 'uppercase');
  assert.equal(safeName('a'.repeat(100)).length <= 100, true);
});

test('nameFromUrl should derive names from URLs', () => {
  assert.equal(nameFromUrl('https://example.com'), 'example-com');
  assert.equal(nameFromUrl('https://example.com/foo/bar'), 'foo-bar');
  assert.equal(nameFromUrl('https://example.com/path/to/page'), 'path-to-page');
  assert.equal(nameFromUrl('not-a-url'), 'screenshot');
  assert.equal(nameFromUrl(''), 'screenshot');
  assert.equal(nameFromUrl('http://localhost:5173'), 'localhost');
});

test('nameFromComponent should derive names from component paths', () => {
  assert.equal(nameFromComponent('./src/Button.tsx'), 'button');
  assert.equal(nameFromComponent('src/components/HeroSection.vue'), 'herosection');
  assert.equal(nameFromComponent('/absolute/path/Card.svelte'), 'card');
  assert.equal(nameFromComponent('index.js'), 'index');
  assert.equal(nameFromComponent('./MyComponent.ts'), 'mycomponent');
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

test('resolveOutputPaths should support jpg output', () => {
  const paths = resolveOutputPaths(tempDir, 'photo', { overwrite: true, format: 'jpg' });
  assert.equal(paths.jpgPath.endsWith('photo.jpg'), true);
});

test('resolveOutputPaths supports overwrite mode', () => {
  const paths1 = resolveOutputPaths(tempDir, 'overwrite-test', { overwrite: true, format: 'png' });
  writeFileSync(paths1.pngPath, 'version1');

  const paths2 = resolveOutputPaths(tempDir, 'overwrite-test', { overwrite: true, format: 'png' });
  assert.equal(paths2.pngPath, paths1.pngPath);
});

test('resolveOutputPaths supports single format png', () => {
  const paths = resolveOutputPaths(tempDir, 'test-png', { overwrite: true, format: 'png' });
  assert.ok(paths.pngPath);
  assert.equal(paths.webpPath, undefined);
  assert.equal(paths.avifPath, undefined);
});

test('resolveOutputPaths supports single format webp', () => {
  const paths = resolveOutputPaths(tempDir, 'test-webp', { overwrite: true, format: 'webp' });
  assert.ok(paths.webpPath);
  assert.equal(paths.pngPath, undefined);
});

test('detectOutputDir returns existing public/ or assets/ or cwd', () => {
  const dir = detectOutputDir();
  assert.ok(typeof dir === 'string');
  assert.ok(dir.length > 0);
});
