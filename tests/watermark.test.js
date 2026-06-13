import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import sharp from 'sharp';
import { applyWatermark } from '../src/watermark.js';

async function createTestBuffer() {
  return sharp({
    create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
  }).png().toBuffer();
}

test('applyWatermark returns a buffer', async () => {
  const buffer = await createTestBuffer();
  const result = await applyWatermark(buffer, 'test');
  assert.ok(Buffer.isBuffer(result));
});

test('output is different from input (has overlay)', async () => {
  const buffer = await createTestBuffer();
  const result = await applyWatermark(buffer, 'test');
  assert.notDeepEqual(result, buffer);
});

test('works with different gravity options', async () => {
  const buffer = await createTestBuffer();
  const gravities = ['northwest', 'northeast', 'southwest', 'southeast', 'center'];
  for (const gravity of gravities) {
    const result = await applyWatermark(buffer, 'test', { gravity });
    assert.ok(Buffer.isBuffer(result), `gravity ${gravity} should return a buffer`);
  }
});

test('works with custom opacity', async () => {
  const buffer = await createTestBuffer();
  const result = await applyWatermark(buffer, 'test', { opacity: 1 });
  assert.ok(Buffer.isBuffer(result));
});

test('empty text still returns buffer', async () => {
  const buffer = await createTestBuffer();
  const result = await applyWatermark(buffer, '');
  assert.ok(Buffer.isBuffer(result));
});
