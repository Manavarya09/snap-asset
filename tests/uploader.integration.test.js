import assert from 'node:assert';
import { test } from 'node:test';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { access } from 'node:fs/promises';

const RUN = process.env.RUN_UPLOADER_INTEGRATION === '1' || process.env.RUN_UPLOADER_INTEGRATION === 'true';

const candidates = [
  fileURLToPath(new URL('../src/uploader.js', import.meta.url)),
  fileURLToPath(new URL('../../src/uploader.js', import.meta.url)),
  resolve(process.cwd(), 'src/uploader.js'),
  resolve(process.cwd(), './snap-asset/src/uploader.js'),
];

test('uploader integration', { skip: !RUN }, async () => {
  let uploaderModule = null;
  for (const p of candidates) {
    try {
      await access(p);
      uploaderModule = await import(pathToFileURL(p).href);
      break;
    } catch {
      // try next
    }
  }

  if (!uploaderModule) {
    throw new Error('Could not resolve src/uploader.js from any candidate path: ' + candidates.join(', '));
  }

  const { getUploader } = uploaderModule;

  const local = await getUploader({ type: 'local', dir: './tmp-uploads' });
  const key = `test-${Date.now()}.bin`;
  const buf = Buffer.from('hello world');
  const res = await local.upload({ buffer: buf, key });
  assert.ok(res.url && res.url.startsWith('file://'));

  try {
    const s3 = await getUploader({ type: 's3' });
    try {
      const r = await s3.upload({ buffer: buf, key });
      console.log('S3 upload result:', r.url);
    } catch (err) {
      console.log('S3 uploader available but upload failed (likely missing creds):', err.message);
    }
  } catch (err) {
    console.log('Skipping S3 uploader test:', err.message);
  }

  try {
    const gcs = await getUploader({ type: 'gcs' });
    try {
      const r = await gcs.upload({ buffer: buf, key });
      console.log('GCS upload result:', r.url);
    } catch (err) {
      console.log('GCS uploader available but upload failed (likely missing creds):', err.message);
    }
  } catch (err) {
    console.log('Skipping GCS uploader test:', err.message);
  }

  try {
    const p = resolve('./tmp-uploads', key);
    await fs.unlink(p);
  } catch {
    // File may not exist
  }
  try {
    await fs.rmdir(resolve('./tmp-uploads'));
  } catch {
    // Directory may not exist
  }
});
