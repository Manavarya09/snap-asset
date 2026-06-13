import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateClip, validateFormat, validateResize } from '../src/commands/validate.js';

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

test('validateFormat rejects null, undefined, numbers, objects', () => {
  assert.throws(() => validateFormat(null), /Invalid format/);
  assert.throws(() => validateFormat(undefined), /Invalid format/);
  assert.throws(() => validateFormat(123), /Invalid format/);
  assert.throws(() => validateFormat([]), /Invalid format/);
});

test('validateFormat rejects case-variant and whitespace-padded formats', () => {
  assert.throws(() => validateFormat('PNG'), /Invalid format/);
  assert.throws(() => validateFormat('WebP'), /Invalid format/);
  assert.throws(() => validateFormat(' png'), /Invalid format/);
  assert.throws(() => validateFormat('png '), /Invalid format/);
});

test('validateResize returns null for empty input', () => {
  assert.equal(validateResize(''), null);
  assert.equal(validateResize(undefined), null);
  assert.equal(validateResize(null), null);
});

test('validateResize accepts valid WxH format', () => {
  assert.equal(validateResize('800x600'), '800x600');
  assert.equal(validateResize('1920x1080'), '1920x1080');
  assert.equal(validateResize('1x1'), '1x1');
  assert.equal(validateResize('99999x99999'), '99999x99999');
});

test('validateResize throws on invalid format', () => {
  assert.throws(() => validateResize('abc'), { message: /Invalid resize/ });
  assert.throws(() => validateResize('x600'), { message: /Invalid resize/ });
  assert.throws(() => validateResize('800x'), { message: /Invalid resize/ });
  assert.throws(() => validateResize('0x0'), { message: /Invalid resize/ });
  assert.throws(() => validateResize('0x100'), { message: /Invalid resize/ });
  assert.throws(() => validateResize('100x0'), { message: /Invalid resize/ });
  assert.throws(() => validateResize('-1x-1'), { message: /Invalid resize/ });
  assert.throws(() => validateResize(' 800x600'), { message: /Invalid resize/ });
  assert.throws(() => validateResize('800x600 '), { message: /Invalid resize/ });
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

test('validateClip throws on invalid clip format', () => {
  assert.throws(() => validateClip('10,20,30'), { message: /Invalid clip value/ });
  assert.throws(() => validateClip('a,b,c,d'), { message: /Invalid clip value/ });
  assert.throws(() => validateClip('1,2,3'), { message: /Invalid clip value/ });
});

test('validateClip throws on negative values', () => {
  assert.throws(() => validateClip('-1,0,100,100'), { message: /Invalid clip value/ });
  assert.throws(() => validateClip('0,0,-100,100'), { message: /Invalid clip value/ });
});

test('validateClip throws on non-integer values', () => {
  assert.throws(() => validateClip('1.5,2,3,4'), { message: /Invalid clip value/ });
});
