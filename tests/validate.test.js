import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateFormat, validateResize, validateClip } from '../src/commands/validate.js';

test('validateFormat accepts all valid formats', () => {
  const valid = ['png', 'webp', 'avif', 'jpeg', 'jpg', 'both'];
  for (const fmt of valid) {
    assert.equal(validateFormat(fmt), fmt);
  }
});

test('validateFormat rejects null and undefined', () => {
  assert.throws(() => validateFormat(null), /Invalid format/);
  assert.throws(() => validateFormat(undefined), /Invalid format/);
});

test('validateFormat rejects numbers and objects', () => {
  assert.throws(() => validateFormat(123), /Invalid format/);
  assert.throws(() => validateFormat({}), /Invalid format/);
});

test('validateFormat rejects uppercase formats', () => {
  assert.throws(() => validateFormat('PNG'), /Invalid format/);
  assert.throws(() => validateFormat('WebP'), /Invalid format/);
  assert.throws(() => validateFormat('JPEG'), /Invalid format/);
});

test('validateFormat rejects formats with whitespace', () => {
  assert.throws(() => validateFormat(' png'), /Invalid format/);
  assert.throws(() => validateFormat('png '), /Invalid format/);
});

test('validateResize accepts valid WxH formats', () => {
  assert.equal(validateResize('800x600'), '800x600');
  assert.equal(validateResize('1920x1080'), '1920x1080');
  assert.equal(validateResize('1x1'), '1x1');
  assert.equal(validateResize('99999x99999'), '99999x99999');
});

test('validateResize returns null for null/undefined/empty', () => {
  assert.equal(validateResize(null), null);
  assert.equal(validateResize(undefined), null);
  assert.equal(validateResize(''), null);
});

test('validateResize throws on invalid strings', () => {
  assert.throws(() => validateResize('abc'), /Invalid resize/);
  assert.throws(() => validateResize('x600'), /Invalid resize/);
  assert.throws(() => validateResize('800x'), /Invalid resize/);
  assert.throws(() => validateResize('0x0'), /Invalid resize/);
  assert.throws(() => validateResize('0x100'), /Invalid resize/);
  assert.throws(() => validateResize('100x0'), /Invalid resize/);
  assert.throws(() => validateResize('-1x-1'), /Invalid resize/);
  assert.throws(() => validateResize('800x600 '), /Invalid resize/);
  assert.throws(() => validateResize(' 800x600'), /Invalid resize/);
});

test('validateClip returns clip object for valid 4-part input', () => {
  assert.deepEqual(validateClip('10,20,300,150'), { x: 10, y: 20, width: 300, height: 150 });
  assert.deepEqual(validateClip('0,0,0,0'), { x: 0, y: 0, width: 0, height: 0 });
  assert.deepEqual(validateClip('100,200,400,500'), { x: 100, y: 200, width: 400, height: 500 });
});

test('validateClip returns null for empty/null/undefined', () => {
  assert.equal(validateClip(''), null);
  assert.equal(validateClip(null), null);
  assert.equal(validateClip(undefined), null);
});

test('validateClip throws on invalid formats', () => {
  assert.throws(() => validateClip('10,20,30'), /Invalid clip/);
  assert.throws(() => validateClip('a,b,c,d'), /Invalid clip/);
  assert.throws(() => validateClip('1,2,3,4,5'), /Invalid clip/);
  assert.throws(() => validateClip('1,2,3,4,'), /Invalid clip/);
});

test('validateClip throws on negative numbers', () => {
  assert.throws(() => validateClip('-1,0,100,100'), /Invalid clip/);
  assert.throws(() => validateClip('0,0,-100,100'), /Invalid clip/);
  assert.throws(() => validateClip('0,0,0,-1'), /Invalid clip/);
});

test('validateClip throws on non-integer values', () => {
  assert.throws(() => validateClip('1.5,2,3,4'), /Invalid clip/);
  assert.throws(() => validateClip('1,2.5,3,4'), /Invalid clip/);
  assert.throws(() => validateClip('1,2,3.5,4'), /Invalid clip/);
  assert.throws(() => validateClip('1,2,3,4.5'), /Invalid clip/);
});
