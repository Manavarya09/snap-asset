import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import sharp from 'sharp';
import { processScreenshot } from '../src/optimizer.js';

const testBuffer = await sharp({
  create: { width: 10, height: 10, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
})
  .png()
  .toBuffer();

test('processScreenshot without format returns all formats', async () => {
  const result = await processScreenshot(testBuffer);
  assert.ok(result.png);
  assert.ok(result.webp);
  assert.ok(result.avif);
  assert.ok(result.jpg);
  assert.ok(result.pngSize > 0);
  assert.ok(result.webpSize > 0);
  assert.ok(result.avifSize > 0);
  assert.ok(result.jpgSize > 0);
});

test('processScreenshot with format png returns only png', async () => {
  const result = await processScreenshot(testBuffer, { format: 'png' });
  assert.ok(result.png);
  assert.equal(result.webp, undefined);
  assert.equal(result.avif, undefined);
  assert.equal(result.jpg, undefined);
  assert.ok(result.pngSize > 0);
});

test('processScreenshot with format webp returns only webp', async () => {
  const result = await processScreenshot(testBuffer, { format: 'webp' });
  assert.equal(result.png, undefined);
  assert.ok(result.webp);
  assert.equal(result.avif, undefined);
  assert.equal(result.jpg, undefined);
  assert.ok(result.webpSize > 0);
});

test('processScreenshot with format avif returns only avif', async () => {
  const result = await processScreenshot(testBuffer, { format: 'avif' });
  assert.equal(result.png, undefined);
  assert.equal(result.webp, undefined);
  assert.ok(result.avif);
  assert.equal(result.jpg, undefined);
  assert.ok(result.avifSize > 0);
});

test('processScreenshot with format jpg returns only jpg', async () => {
  const result = await processScreenshot(testBuffer, { format: 'jpg' });
  assert.equal(result.png, undefined);
  assert.equal(result.webp, undefined);
  assert.equal(result.avif, undefined);
  assert.ok(result.jpg);
  assert.ok(result.jpgSize > 0);
});

test('processScreenshot with format jpeg returns only jpg', async () => {
  const result = await processScreenshot(testBuffer, { format: 'jpeg' });
  assert.equal(result.png, undefined);
  assert.equal(result.webp, undefined);
  assert.equal(result.avif, undefined);
  assert.ok(result.jpg);
  assert.ok(result.jpgSize > 0);
});

test('processScreenshot with format both returns all formats', async () => {
  const result = await processScreenshot(testBuffer, { format: 'both' });
  assert.ok(result.png);
  assert.ok(result.webp);
  assert.ok(result.avif);
  assert.ok(result.jpg);
});
