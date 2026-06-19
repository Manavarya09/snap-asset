import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateFormat, validateResize, validateClip } from '../src/commands/validate.js';

test('validateFormat accepts all valid formats', () => {
  const formats = ['png', 'webp', 'avif', 'jpeg', 'jpg', 'both'];
  for (const f of formats) {
    assert.doesNotThrow(() => validateFormat(f));
  }
});

test('validateFormat rejects invalid formats', () => {
  assert.throws(() => validateFormat('gif'), /Invalid format/);
  assert.throws(() => validateFormat('svg'), /Invalid format/);
  assert.throws(() => validateFormat(''), /Invalid format/);
  assert.throws(() => validateFormat(null), /Invalid format/);
});

test('validateResize accepts valid resize strings', () => {
  assert.equal(validateResize('800x600'), '800x600');
  assert.equal(validateResize('1920x1080'), '1920x1080');
  assert.equal(validateResize('1x1'), '1x1');
});

test('validateResize rejects invalid resize strings', () => {
  assert.throws(() => validateResize('0x100'), /Invalid resize/);
  assert.throws(() => validateResize('100x0'), /Invalid resize/);
  assert.throws(() => validateResize('abc'), /Invalid resize/);
  assert.throws(() => validateResize('x'), /Invalid resize/);
});

test('validateResize returns null for empty input', () => {
  assert.equal(validateResize(null), null);
  assert.equal(validateResize(undefined), null);
  assert.equal(validateResize(''), null);
});

test('validateClip accepts valid clip strings', () => {
  const result = validateClip('10,20,100,200');
  assert.deepEqual(result, { x: 10, y: 20, width: 100, height: 200 });
});

test('validateClip rejects invalid clip strings', () => {
  assert.throws(() => validateClip('1,2,3'), /Invalid clip/);
  assert.throws(() => validateClip('a,b,c,d'), /Invalid clip/);
  assert.throws(() => validateClip('-1,0,100,100'), /Invalid clip/);
});

test('validateClip rejects zero-or-negative dimensions', () => {
  assert.throws(() => validateClip('0,0,0,0'), /Invalid clip/);
  assert.throws(() => validateClip('10,20,0,100'), /Invalid clip/);
});

test('validateClip returns null for empty input', () => {
  assert.equal(validateClip(null), null);
  assert.equal(validateClip(undefined), null);
  assert.equal(validateClip(''), null);
});
