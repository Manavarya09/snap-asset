import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateFile, parseUrlList } from '../src/commands/validate.js';

test('parseUrlList skips empty lines and comments', () => {
  const input = '# https://example.com\nhttps://foo.com\n\nhttps://bar.com\n  \nhttps://baz.com';
  const result = parseUrlList(input);
  assert.deepEqual(result, ['https://foo.com', 'https://bar.com', 'https://baz.com']);
});

test('parseUrlList trims whitespace from lines', () => {
  const input = '  https://example.com  \n  https://foo.com  ';
  const result = parseUrlList(input);
  assert.deepEqual(result, ['https://example.com', 'https://foo.com']);
});

test('parseUrlList returns empty array for empty input', () => {
  assert.deepEqual(parseUrlList(''), []);
  assert.deepEqual(parseUrlList('# only comments'), []);
  assert.deepEqual(parseUrlList('\n\n\n'), []);
});

test('parseUrlList handles single line', () => {
  assert.deepEqual(parseUrlList('https://example.com'), ['https://example.com']);
});

test('validateFile throws for non-existent path', () => {
  assert.throws(() => validateFile('/nonexistent/path/file.json'), /File not found/);
});

test('validateFile returns path for readable file', () => {
  const path = 'package.json';
  const result = validateFile(path);
  assert.equal(result, path);
});
