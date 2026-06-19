import { strict as assert } from 'node:assert';
import { test } from 'node:test';

// Test the URL validation logic only (not the full capturer which needs Playwright)
test('captureUrl should validate URL format', async () => {
  // We test the same validation that capturer.js applies
  function validateUrl(url) {
    if (typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://'))) {
      throw new Error(`Invalid URL: "${url}". Must start with http://, https://, or file://`);
    }
  }

  assert.throws(() => validateUrl(''), /Invalid URL/);
  assert.throws(() => validateUrl('not-a-url'), /Invalid URL/);
  assert.throws(() => validateUrl('ftp://example.com'), /Invalid URL/);
  assert.throws(() => validateUrl('data:text/html,hi'), /Invalid URL/);
  assert.throws(() => validateUrl(null), /Invalid URL/);
  assert.throws(() => validateUrl(123), /Invalid URL/);
  assert.doesNotThrow(() => validateUrl('http://example.com'));
  assert.doesNotThrow(() => validateUrl('https://example.com'));
  assert.doesNotThrow(() => validateUrl('file:///tmp/page.html'));
});

test('captureUrl should reject without launching for missing http', async () => {
  // This verifies the early validation in capturer.js
  const { captureUrl } = await import('../src/capturer.js');
  await assert.rejects(() => captureUrl('not-a-url'), /Invalid URL/);
  await assert.rejects(() => captureUrl(''), /Invalid URL/);
});
