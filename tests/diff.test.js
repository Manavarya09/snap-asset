import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import sharp from 'sharp';
import { compareScreenshots, createComparisonImage } from '../src/diff.js';

async function createTestBuffer(r, g, b) {
  return sharp({
    create: { width: 10, height: 10, channels: 3, background: { r, g, b } },
  }).png().toBuffer();
}

test('compareScreenshots returns a buffer', async () => {
  const buf1 = await createTestBuffer(255, 0, 0);
  const buf2 = await createTestBuffer(0, 0, 255);
  const result = await compareScreenshots(buf1, buf2);
  assert.ok(Buffer.isBuffer(result));
});

test('createComparisonImage returns a buffer', async () => {
  const buf1 = await createTestBuffer(255, 0, 0);
  const buf2 = await createTestBuffer(0, 255, 0);
  const result = await createComparisonImage([buf1, buf2]);
  assert.ok(Buffer.isBuffer(result));
});

test('createComparisonImage throws with empty array', async () => {
  await assert.rejects(
    () => createComparisonImage([]),
    { message: 'At least one buffer is required' },
  );
});
