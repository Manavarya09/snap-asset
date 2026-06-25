import { test } from 'node:test';
import assert from 'node:assert';
import { access, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const EXPECTED_SRC_FILES = [
  'index.js',
  'capturer.js',
  'optimizer.js',
  'output.js',
  'config.js',
  'cache.js',
  'logger.js',
  'component-renderer.js',
  'uploader.js',
  'diff.js',
];

/** @returns {Promise<{main: string, bin: Record<string, string>}>} */
async function readPkg() {
  return JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8'));
}

test('package.json exports main', async () => {
  const pkg = await readPkg();
  assert.ok(pkg.main, 'package.json must have "main" field');
  assert.equal(pkg.main, 'src/index.js');
});

test('package.json exports bin', async () => {
  const pkg = await readPkg();
  assert.ok(pkg.bin, 'package.json must have "bin" field');
  assert.ok(pkg.bin['snap-asset'], 'bin must include snap-asset entry');
  assert.equal(pkg.bin['snap-asset'], './bin/snap-asset.js');
});

for (const file of EXPECTED_SRC_FILES) {
  test(`src/${file} exists`, async () => {
    await assert.doesNotReject(access(resolve(ROOT, 'src', file)));
  });
}

test('bin/snap-asset.js is executable', async () => {
  const filePath = resolve(ROOT, 'bin/snap-asset.js');
  const s = await stat(filePath);
  assert.ok(s.isFile(), 'bin/snap-asset.js must be a file');
  assert.ok(
    s.mode & 0o111,
    'bin/snap-asset.js must be executable (one of owner/group/other execute bit set)',
  );
});
