import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateClip } from '../bin/snap-asset.js';

test('validateClip should return clip object for valid input', () => {
  const clip = validateClip('10,20,300,150');
  assert.deepEqual(clip, { x: 10, y: 20, width: 300, height: 150 });
});

test('validateClip should return null when input is empty', () => {
  assert.equal(validateClip(''), null);
  assert.equal(validateClip(undefined), null);
});

test('validateClip should throw on invalid clip format', async () => {
  await assert.rejects(() => Promise.resolve(validateClip('10,20,30')),
    { message: /Invalid clip value/ });
});

test('validateClip should throw on negative values', async () => {
  await assert.rejects(() => Promise.resolve(validateClip('-1,0,100,100')),
    { message: /Invalid clip value/ });
});
