import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import sharp from 'sharp';
import { optimizePng, toWebp, processScreenshot, getMetadata } from '../src/optimizer.js';

const blankBuffer = await sharp({
  create: { width: 10, height: 10, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
})
  .png()
  .toBuffer();

test('optimizePng handles resize option', async () => {
  const result = await optimizePng(blankBuffer, { resize: null });
  assert.ok(Buffer.isBuffer(result));
  assert.ok(result.length > 0);
});

test('optimizePng with resize dimension parsing', async () => {
  const result = await optimizePng(blankBuffer);
  assert.ok(Buffer.isBuffer(result));
  assert.ok(result.length > 0);
});

test('toWebp with lossless mode', async () => {
  const result = await toWebp(blankBuffer, { lossless: true });
  assert.ok(Buffer.isBuffer(result));
  assert.ok(result.length > 0);
});

test('toWebp with very high quality', async () => {
  const result = await toWebp(blankBuffer, { quality: 100 });
  assert.ok(Buffer.isBuffer(result));
  assert.ok(result.length > 0);
});

test('toWebp with very low quality', async () => {
  const result = await toWebp(blankBuffer, { quality: 1 });
  assert.ok(Buffer.isBuffer(result));
  assert.ok(result.length > 0);
});

test('processScreenshot returns all formats with sizes', async () => {
  const result = await processScreenshot(blankBuffer);
  assert.ok(Buffer.isBuffer(result.png));
  assert.ok(Buffer.isBuffer(result.webp));
  assert.ok(Buffer.isBuffer(result.avif));
  assert.ok(Buffer.isBuffer(result.jpg));
  assert.equal(typeof result.pngSize, 'number');
  assert.equal(typeof result.webpSize, 'number');
  assert.equal(typeof result.avifSize, 'number');
  assert.equal(typeof result.jpgSize, 'number');
  assert.ok(result.pngSize > 0);
  assert.ok(result.webpSize > 0);
  assert.ok(result.avifSize > 0);
  assert.ok(result.jpgSize > 0);
});

test('getMetadata returns correct metadata', async () => {
  const meta = await getMetadata(blankBuffer);
  assert.equal(meta.format, 'png');
  assert.equal(meta.width, 10);
  assert.equal(meta.height, 10);
});

test('optimizePng rejects empty buffer', async () => {
  await assert.rejects(() => optimizePng(Buffer.alloc(0)));
});

test('optimizePng rejects invalid buffer', async () => {
  await assert.rejects(() => optimizePng(Buffer.from('not-an-image')));
});
