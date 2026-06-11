import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateClip, validateFormat, validateResize } from '../bin/snap-asset.js';

test('validateFormat accepts valid formats', () => {
  const valid = ['png', 'webp', 'avif', 'jpeg', 'jpg', 'both'];
  for (const fmt of valid) {
    assert.equal(validateFormat(fmt), fmt);
  }
});

test('validateFormat throws on invalid format', () => {
  assert.throws(() => validateFormat('gif'), { message: /Invalid format/ });
  assert.throws(() => validateFormat('svg'), { message: /Invalid format/ });
  assert.throws(() => validateFormat(''), { message: /Invalid format/ });
});

test('validateResize returns null for empty input', () => {
  assert.equal(validateResize(''), null);
  assert.equal(validateResize(undefined), null);
});

test('validateResize accepts valid WxH format', () => {
  assert.equal(validateResize('800x600'), '800x600');
  assert.equal(validateResize('1920x1080'), '1920x1080');
  assert.equal(validateResize('1x1'), '1x1');
});

test('validateResize throws on invalid format', () => {
  assert.throws(() => validateResize('abc'), { message: /Invalid resize/ });
  assert.throws(() => validateResize('x600'), { message: /Invalid resize/ });
  assert.throws(() => validateResize('800x'), { message: /Invalid resize/ });
  assert.throws(() => validateResize('0x0'), { message: /Invalid resize/ });
});

test('validateClip returns clip object for valid input', () => {
  const clip = validateClip('10,20,300,150');
  assert.deepEqual(clip, { x: 10, y: 20, width: 300, height: 150 });
});

test('validateClip returns null when input is empty', () => {
  assert.equal(validateClip(''), null);
  assert.equal(validateClip(undefined), null);
  assert.equal(validateClip(null), null);
});

test('validateClip throws on invalid clip format', async () => {
  await assert.rejects(() => Promise.resolve(validateClip('10,20,30')), { message: /Invalid clip value/ });
  await assert.rejects(() => Promise.resolve(validateClip('a,b,c,d')), { message: /Invalid clip value/ });
  await assert.rejects(() => Promise.resolve(validateClip('1,2,3')), { message: /Invalid clip value/ });
});

test('validateClip throws on negative values', async () => {
  await assert.rejects(() => Promise.resolve(validateClip('-1,0,100,100')), { message: /Invalid clip value/ });
  await assert.rejects(() => Promise.resolve(validateClip('0,0,-100,100')), { message: /Invalid clip value/ });
});

test('validateClip throws on non-integer values', async () => {
  await assert.rejects(() => Promise.resolve(validateClip('1.5,2,3,4')), { message: /Invalid clip value/ });
});
