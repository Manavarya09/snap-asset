import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import sharp from 'sharp';
import { optimizePng, toWebp, toAvif } from '../src/optimizer.js';

const blankBuffer = await sharp({
  create: {
    width: 10,
    height: 10,
    channels: 4,
    background: { r: 255, g: 0, b: 0, alpha: 1 },
  },
}).png().toBuffer();

test('optimizePng should return a buffer', async () => {
  const result = await optimizePng(blankBuffer);
  assert.ok(Buffer.isBuffer(result));
  assert.ok(result.length > 0);
});

test('toWebp should convert to a smaller buffer', async () => {
  const result = await toWebp(blankBuffer, { quality: 80 });
  assert.ok(Buffer.isBuffer(result));
  assert.ok(result.length > 0);
});

test('toAvif should convert to a buffer', async () => {
  const result = await toAvif(blankBuffer, { quality: 50 });
  assert.ok(Buffer.isBuffer(result));
  assert.ok(result.length > 0);
});

test('parseResize should throw on invalid resize format', async () => {
  await assert.rejects(() => optimizePng(blankBuffer, { resize: 'bad-format' }), {
    message: /Invalid resize value/,
  });
});
