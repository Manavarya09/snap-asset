import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { rmSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  safeName,
  nameFromUrl,
  resolveOutputPaths,
  detectOutputDir,
  generatePictureHtml,
  saveMetadata,
} from '../src/output.js';

const tempDir = join(process.cwd(), 'tests', 'temp-output-edge');
try {
  rmSync(tempDir, { recursive: true, force: true });
} catch {
  // Directory may not exist yet
}

test('saveMetadata writes metadata file with all formats', async () => {
  mkdirSync(tempDir, { recursive: true });
  const paths = {
    metadataPath: join(tempDir, 'meta.json'),
    pngPath: join(tempDir, 'test.png'),
    webpPath: join(tempDir, 'test.webp'),
    avifPath: join(tempDir, 'test.avif'),
    jpgPath: join(tempDir, 'test.jpg'),
  };
  const info = {
    url: 'https://example.com',
    width: 800,
    height: 600,
    scale: 2,
    pngSize: 100,
    webpSize: 200,
    avifSize: 300,
    jpgSize: 400,
  };
  await saveMetadata(paths, info);
  const content = JSON.parse(readFileSync(paths.metadataPath, 'utf-8'));
  assert.equal(content.url, 'https://example.com');
  assert.equal(content.width, 800);
  assert.equal(content.height, 600);
  assert.equal(content.scale, 2);
  assert.equal(content.formats.png.size, 100);
  assert.equal(content.formats.webp.size, 200);
  assert.equal(content.formats.avif.size, 300);
  assert.equal(content.formats.jpg.size, 400);
});

test('saveMetadata does nothing without metadataPath', async () => {
  const info = { url: 'https://example.com' };
  await saveMetadata({ pngPath: join(tempDir, 'x.png') }, info);
});

test('saveMetadata handles partial formats', async () => {
  const paths = {
    metadataPath: join(tempDir, 'meta-partial.json'),
    pngPath: join(tempDir, 'partial.png'),
  };
  const info = { url: 'https://x.com', pngSize: 50 };
  await saveMetadata(paths, info);
  const content = JSON.parse(readFileSync(paths.metadataPath, 'utf-8'));
  assert.ok(content.formats.png);
  assert.equal(content.formats.png.size, 50);
  assert.equal(content.formats.webp, undefined);
});

test('generatePictureHtml with all options', () => {
  const html = generatePictureHtml('hero', {
    alt: 'Hero image',
    className: 'hero-img',
    basePath: '/assets',
  });
  assert.match(html, /<picture>/);
  assert.match(html, /srcset="\/assets\/hero\.avif"/);
  assert.match(html, /srcset="\/assets\/hero\.webp"/);
  assert.match(html, /src="\/assets\/hero\.png"/);
  assert.match(html, /alt="Hero image"/);
  assert.match(html, /class="hero-img"/);
  assert.match(html, /loading="lazy"/);
});

test('generatePictureHtml with no options (defaults)', () => {
  const html = generatePictureHtml('hero');
  assert.match(html, /<picture>/);
  assert.match(html, /srcset="hero\.avif"/);
  assert.match(html, /srcset="hero\.webp"/);
  assert.match(html, /src="hero\.png"/);
  assert.match(html, /alt=""/);
  assert.doesNotMatch(html, /class="/);
});

test('detectOutputDir falls back to screenshots when no candidates exist', () => {
  const result = detectOutputDir('/nonexistent-dir-xyz');
  assert.ok(result.endsWith('screenshots'));
});

test('safeName handles unicode characters', () => {
  assert.equal(safeName('héllo wörld'), 'h-llo-w-rld');
  assert.equal(safeName('中文测试'), 'screenshot');
  assert.equal(safeName('日本語'), 'screenshot');
});

test('safeName handles very long strings', () => {
  const long = 'a'.repeat(200);
  const result = safeName(long);
  assert.ok(result.length <= 80);
  assert.equal(result, 'a'.repeat(80));
});

test('nameFromUrl with complex URLs', () => {
  assert.equal(nameFromUrl('https://user:pass@example.com:8080/path/to/page?q=1&r=2#section'), 'path-to-page');
  assert.equal(nameFromUrl('https://example.com/search?q=hello+world'), 'search');
  assert.equal(nameFromUrl('https://example.com/path?a=1&b=2'), 'path');
  assert.equal(nameFromUrl('ftp://files.example.com/download/file.txt'), 'download-file-txt');
});

test('nameFromUrl with IP addresses', () => {
  assert.equal(nameFromUrl('http://127.0.0.1:5173'), '127-0-0-1');
  assert.equal(nameFromUrl('http://192.168.1.1/admin'), 'admin');
  assert.equal(nameFromUrl('http://10.0.0.1'), '10-0-0-1');
});

test('resolveOutputPaths with format avif', () => {
  const paths = resolveOutputPaths(tempDir, 'test-avif', { overwrite: true, format: 'avif' });
  assert.ok(paths.avifPath);
  assert.equal(paths.pngPath, undefined);
  assert.equal(paths.webpPath, undefined);
  assert.equal(paths.jpgPath, undefined);
});

test('resolveOutputPaths with format jpeg', () => {
  const paths = resolveOutputPaths(tempDir, 'test-jpeg', { overwrite: true, format: 'jpeg' });
  assert.ok(paths.jpgPath);
  assert.ok(paths.jpgPath.endsWith('test-jpeg.jpeg'));
  assert.equal(paths.pngPath, undefined);
  assert.equal(paths.webpPath, undefined);
  assert.equal(paths.avifPath, undefined);
});
