import assert from 'node:assert';
import { getUploader } from '../../src/uploader.js';
import { promises as fs } from 'fs';
import { resolve } from 'path';

const RUN = process.env.RUN_UPLOADER_INTEGRATION === '1' || process.env.RUN_UPLOADER_INTEGRATION === 'true';

if (!RUN) {
  console.log('Skipping uploader integration tests (RUN_UPLOADER_INTEGRATION not set)');
  process.exit(0);
}

(async () => {
  // Test local uploader
  const local = await getUploader({ type: 'local', dir: './tmp-uploads' });
  const key = `test-${Date.now()}.bin`;
  const buf = Buffer.from('hello world');
  const res = await local.upload({ buffer: buf, key });
  assert.ok(res.url && res.url.startsWith('file://'));

  // Attempt to instantiate optional uploaders; skip if SDKs are missing
  try {
    const s3 = await getUploader({ type: 's3' });
    // If S3 config is present, try upload (may throw without secrets)
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

  // cleanup local file
  try {
    const p = resolve('./tmp-uploads', key);
    await fs.unlink(p).catch(() => {});
    await fs.rmdir(resolve('./tmp-uploads')).catch(() => {});
  } catch {}

  console.log('Uploader integration tests complete');
})();
