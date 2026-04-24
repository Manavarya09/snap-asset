export default async function createGcsUploader(opts = {}) {
  let pkg;
  try {
    pkg = await import('@google-cloud/storage');
  } catch (err) {
    throw new Error('GCS SDK not installed. Install @google-cloud/storage to use GCS uploader.');
  }

  const { Storage } = pkg;
  const storage = new Storage(opts.credentials ? { credentials: opts.credentials } : undefined);
  const bucketName = opts.bucket || process.env.GCS_BUCKET;
  const prefix = opts.prefix || '';

  if (!bucketName) throw new Error('GCS uploader requires a bucket (opts.bucket or GCS_BUCKET env)');

  const bucket = storage.bucket(bucketName);

  return {
    async upload({ buffer, key, contentType = 'application/octet-stream' }) {
      const file = bucket.file(`${prefix}${key}`);
      await file.save(buffer, { contentType });
      return { url: `gs://${bucketName}/${prefix}${key}` };
    }
  };
}
