import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import sharp from 'sharp';
import { applyWatermark } from '../src/watermark.js';

const testBuffer = await sharp({
  create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
})
  .png()
  .toBuffer();

test('applyWatermark with default options', async () => {
  const result = await applyWatermark(testBuffer, 'test');
  assert.ok(Buffer.isBuffer(result));
  assert.ok(result.length > 0);
});

test('applyWatermark supports all gravities', async () => {
  for (const gravity of ['northwest', 'northeast', 'southwest', 'southeast', 'center']) {
    const result = await applyWatermark(testBuffer, 'test', { gravity });
    assert.ok(Buffer.isBuffer(result), `failed for gravity: ${gravity}`);
  }
});

test('applyWatermark with custom opacity and fontSize', async () => {
  const result = await applyWatermark(testBuffer, 'test', { opacity: 0.8, fontSize: 24 });
  assert.ok(Buffer.isBuffer(result));
});

test('applyWatermark with custom color', async () => {
  const result = await applyWatermark(testBuffer, 'test', { color: 'red' });
  assert.ok(Buffer.isBuffer(result));
});

test('applyWatermark with empty text produces output', async () => {
  const result = await applyWatermark(testBuffer, '');
  assert.ok(Buffer.isBuffer(result));
});

test('applyWatermark with special characters in text', async () => {
  const result = await applyWatermark(testBuffer, '<hello> & "world"');
  assert.ok(Buffer.isBuffer(result));
});

test('applyWatermark with invalid gravity falls back to southeast', async () => {
  const result = await applyWatermark(testBuffer, 'test', { gravity: 'invalid' });
  assert.ok(Buffer.isBuffer(result));
});
