import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  safeName, nameFromUrl, nameFromComponent, resolveOutputPaths,
  detectOutputDir, generatePictureHtml, saveAssets, savePdf, cleanup,
} from '../src/output.js';
import { existsSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const tempDir = join(process.cwd(), 'tests', 'temp-output');

try {
  rmSync(tempDir, { recursive: true, force: true });
} catch {
  // Directory may not exist yet
}

assert.ok(!existsSync(tempDir));

test('safeName sanitizes names correctly', () => {
  assert.equal(safeName('Hello World!'), 'hello-world');
  assert.equal(safeName('   Foo___Bar   '), 'foo-bar');
  assert.equal(safeName(''), 'screenshot');
  assert.equal(safeName('  '), 'screenshot');
  assert.equal(safeName('SPECIAL_Chars-123'), 'special-chars-123');
  assert.equal(safeName('UPPERCASE'), 'uppercase');
});

test('nameFromUrl derives names from URLs', () => {
  assert.equal(nameFromUrl('https://example.com'), 'example-com');
  assert.equal(nameFromUrl('https://example.com/foo/bar'), 'foo-bar');
  assert.equal(nameFromUrl('https://example.com/path/to/page'), 'path-to-page');
  assert.equal(nameFromUrl('not-a-url'), 'screenshot');
  assert.equal(nameFromUrl(''), 'screenshot');
});

test('nameFromComponent derives names from component paths', () => {
  assert.equal(nameFromComponent('./src/Button.tsx'), 'button');
  assert.equal(nameFromComponent('src/components/HeroSection.vue'), 'herosection');
  assert.equal(nameFromComponent('/absolute/path/Card.svelte'), 'card');
});

test('resolveOutputPaths creates directory and avoids collision', () => {
  const paths1 = resolveOutputPaths(tempDir, 'image', { overwrite: false, format: 'both' });
  assert.ok(paths1.pngPath.endsWith('image.png'));
  assert.ok(paths1.webpPath.endsWith('image.webp'));

  writeFileSync(paths1.pngPath, '');
  writeFileSync(paths1.webpPath, '');

  const paths2 = resolveOutputPaths(tempDir, 'image', { overwrite: false, format: 'both' });
  assert.ok(paths2.pngPath.includes('image-1.png'));
  assert.ok(paths2.webpPath.includes('image-1.webp'));
});

test('resolveOutputPaths supports overwrite mode', () => {
  const paths1 = resolveOutputPaths(tempDir, 'overwrite-test', { overwrite: true, format: 'png' });
  writeFileSync(paths1.pngPath, 'v1');
  const paths2 = resolveOutputPaths(tempDir, 'overwrite-test', { overwrite: true, format: 'png' });
  assert.equal(paths2.pngPath, paths1.pngPath);
});

test('savePdf writes a file', async () => {
  const pdfPath = join(tempDir, 'test.pdf');
  const pdfContent = Buffer.from('%PDF-1.4 fake pdf');
  const result = await savePdf(pdfContent, pdfPath);
  assert.ok(existsSync(pdfPath));
  assert.equal(result.path, pdfPath);
  assert.equal(result.size, pdfContent.length);
});

test('cleanup removes a directory', async () => {
  const dir = join(tempDir, 'cleanup-test');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'file.txt'), 'content');
  assert.ok(existsSync(dir));
  await cleanup(dir);
  assert.ok(!existsSync(dir));
});

test('output with unicode filenames', () => {
  const name = safeName('héllo wörld screenshot');
  assert.equal(name, 'h-llo-w-rld-screenshot');
  const paths = resolveOutputPaths(tempDir, name, { overwrite: true, format: 'png' });
  assert.ok(paths.pngPath.endsWith('h-llo-w-rld-screenshot.png'));
});

test('output collision avoidance increments counter', () => {
  const paths1 = resolveOutputPaths(tempDir, 'collision', { overwrite: false, format: 'png' });
  writeFileSync(paths1.pngPath, '');

  const paths2 = resolveOutputPaths(tempDir, 'collision', { overwrite: false, format: 'png' });
  assert.ok(paths2.pngPath.includes('collision-1'));
  writeFileSync(paths2.pngPath, '');

  const paths3 = resolveOutputPaths(tempDir, 'collision', { overwrite: false, format: 'png' });
  assert.ok(paths3.pngPath.includes('collision-2'));
});

test('saveAssets writes files and returns sizes', async () => {
  const paths = resolveOutputPaths(tempDir, 'save-test', { overwrite: true, format: 'both' });
  const buffers = { png: Buffer.from('png-data'), webp: Buffer.from('webp-data') };
  const saved = await saveAssets(paths, buffers);
  assert.equal(saved.length, 2);
  assert.ok(existsSync(paths.pngPath));
  assert.ok(existsSync(paths.webpPath));
  assert.equal(saved[0].size, 8);
  assert.equal(saved[1].size, 9);
});

test('generatePictureHtml renders correct markup', () => {
  const html = generatePictureHtml('hero', { alt: 'Hero', className: 'img-hero', basePath: '/assets' });
  assert.match(html, /<picture>/);
  assert.match(html, /srcset="\/assets\/hero\.avif"/);
  assert.match(html, /srcset="\/assets\/hero\.webp"/);
  assert.match(html, /src="\/assets\/hero\.png"/);
  assert.match(html, /alt="Hero"/);
});

test('detectOutputDir falls back to screenshots', () => {
  const dir = detectOutputDir('/nonexistent-path-xyz');
  assert.ok(dir.endsWith('screenshots'));
});
