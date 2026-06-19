import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import sharp from 'sharp';
import { createComparisonImage, compareScreenshots } from '../src/diff.js';

const makeTestImage = async (r, g, b) => {
  return sharp({ create: { width: 20, height: 20, channels: 4, background: { r, g, b, alpha: 1 } } })
    .png()
    .toBuffer();
};

test('createComparisonImage throws for empty buffers', async () => {
  await assert.rejects(() => createComparisonImage([]), /At least one buffer/);
  await assert.rejects(() => createComparisonImage(null), /At least one buffer/);
  await assert.rejects(() => createComparisonImage(undefined), /At least one buffer/);
});

test('createComparisonImage with single image', async () => {
  const img = await makeTestImage(255, 0, 0);
  const result = await createComparisonImage([img]);
  assert.ok(Buffer.isBuffer(result));
  assert.ok(result.length > 0);
});

test('createComparisonImage with multiple images', async () => {
  const img1 = await makeTestImage(255, 0, 0);
  const img2 = await makeTestImage(0, 255, 0);
  const img3 = await makeTestImage(0, 0, 255);
  const result = await createComparisonImage([img1, img2, img3]);
  assert.ok(Buffer.isBuffer(result));
  assert.ok(result.length > 0);
});

test('createComparisonImage with custom columns', async () => {
  const img1 = await makeTestImage(255, 0, 0);
  const img2 = await makeTestImage(0, 255, 0);
  const result = await createComparisonImage([img1, img2], { columns: 1, gap: 4 });
  assert.ok(Buffer.isBuffer(result));
  assert.ok(result.length > 0);
});

test('createComparisonImage with custom background', async () => {
  const img = await makeTestImage(255, 0, 0);
  const result = await createComparisonImage([img], { background: '#000000' });
  assert.ok(Buffer.isBuffer(result));
});

test('compareScreenshots produces different output for different images', async () => {
  const red = await makeTestImage(255, 0, 0);
  const blue = await makeTestImage(0, 0, 255);
  const diff = await compareScreenshots(red, blue);
  assert.ok(Buffer.isBuffer(diff));
  assert.ok(diff.length > 0);
});

test('compareScreenshots handles identical images', async () => {
  const img = await makeTestImage(128, 128, 128);
  const diff = await compareScreenshots(img, img);
  assert.ok(Buffer.isBuffer(diff));
  assert.ok(diff.length > 0);
});
