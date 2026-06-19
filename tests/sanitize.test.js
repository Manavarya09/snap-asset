import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { sanitizeFilename, truncate, formatBytes } from '../src/commands/sanitize.js';

test('sanitizeFilename removes special characters', () => {
  assert.equal(sanitizeFilename('Hello World!'), 'hello-world');
  assert.equal(sanitizeFilename('  foo  '), 'foo');
  assert.equal(sanitizeFilename('UPPERCASE'), 'uppercase');
  assert.equal(sanitizeFilename('file.name'), 'file.name');
  assert.equal(sanitizeFilename('path/to/file'), 'path-to-file');
});

test('sanitizeFilename handles empty and edge inputs', () => {
  assert.equal(sanitizeFilename(''), '');
  assert.equal(sanitizeFilename('   '), '');
  assert.equal(sanitizeFilename('!@#$%'), '');
});

test('truncate returns short strings unchanged', () => {
  assert.equal(truncate('hello', 10), 'hello');
  assert.equal(truncate('hi', 2), 'hi');
});

test('truncate appends ellipsis for long strings', () => {
  const result = truncate('hello world this is long', 10);
  assert.equal(result, 'hello worl...');
  assert.ok(result.length <= 14);
});

test('truncate handles empty string', () => {
  assert.equal(truncate('', 5), '');
  assert.equal(truncate('', 0), '');
});

test('formatBytes formats various sizes', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(500), '500 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(1048576), '1.0 MB');
  assert.equal(formatBytes(1073741824), '1.0 GB');
  assert.equal(formatBytes(10737418240), '10.0 GB');
});
