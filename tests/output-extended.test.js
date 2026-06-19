import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import {
  safeName,
  nameFromUrl,
  nameFromComponent,
  resolveOutputPaths,
  detectOutputDir,
  generatePictureHtml,
  saveMetadata,
} from '../src/output.js';

const tempDir = join(process.cwd(), 'tests', 'temp-output-ext');
try { rmSync(tempDir, { recursive: true, force: true }); } catch {}

test('safeName handles strings with only special chars', () => {
  assert.equal(safeName('___...___'), 'screenshot');
  assert.equal(safeName('!@#$%'), 'screenshot');
});

test('safeName preserves hyphens between words', () => {
  assert.equal(safeName('hello-world'), 'hello-world');
  assert.equal(safeName('foo-bar-baz'), 'foo-bar-baz');
});

test('nameFromUrl handles URLs with ports', () => {
  assert.equal(nameFromUrl('http://localhost:3000'), 'localhost');
  assert.equal(nameFromUrl('http://localhost:3000/path'), 'path');
});

test('nameFromComponent handles complex paths', () => {
  assert.equal(nameFromComponent('src/components/ui/Button.tsx'), 'button');
  assert.equal(nameFromComponent('src/components/forms/InputField.jsx'), 'inputfield');
});

test('detectOutputDir finds public directory', () => {
  const dir = detectOutputDir(process.cwd());
  assert.ok(typeof dir === 'string');
});

test('generatePictureHtml escapes special characters in alt', () => {
  const html = generatePictureHtml('img', { alt: 'Hello "World" & <Co.>' });
  assert.match(html, /Hello &quot;World&quot; &amp; &lt;Co.&gt;/);
});

test('generatePictureHtml escapes special characters in className', () => {
  const html = generatePictureHtml('img', { className: 'my"class"name' });
  assert.match(html, /my&quot;class&quot;name/);
});

test('generatePictureHtml with no alt text renders empty alt', () => {
  const html = generatePictureHtml('img');
  assert.match(html, /alt=""/);
});

test('resolveOutputPaths with timestamp option', () => {
  const paths = resolveOutputPaths(tempDir, 'ts-test', { overwrite: true, timestamp: true, format: 'png' });
  assert.ok(paths.pngPath.includes('ts-test-'));
  const datePart = paths.pngPath.match(/ts-test-(\d{8}-\d{6})/);
  assert.ok(datePart, 'Timestamp format should be YYYYMMDD-HHmmss');
});

test('resolveOutputPaths with pdf format', () => {
  const paths = resolveOutputPaths(tempDir, 'doc', { overwrite: true, format: 'pdf' });
  assert.ok(paths.pdfPath);
  assert.equal(paths.pngPath, undefined);
  assert.equal(paths.webpPath, undefined);
});

test('resolveOutputPaths with metadata option', () => {
  const paths = resolveOutputPaths(tempDir, 'meta-test', { overwrite: true, format: 'png', metadata: true });
  assert.ok(paths.metadataPath);
  assert.ok(paths.metadataPath.endsWith('.json'));
});

test('saveMetadata handles null info gracefully', async () => {
  const paths = { metadataPath: join(tempDir, 'null-meta.json') };
  await saveMetadata(paths, {});
  const content = JSON.parse(require('fs').readFileSync(paths.metadataPath, 'utf-8'));
  assert.ok(content.captured);
  assert.equal(content.url, undefined);
});

try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
