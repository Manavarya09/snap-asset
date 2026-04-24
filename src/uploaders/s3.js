export default async function createS3Uploader(opts = {}) {
  // Lazy import to avoid hard dependency during tests
  let aws;
  try {
    aws = await import('@aws-sdk/client-s3');
  } catch (err) {
    throw new Error('AWS SDK not installed. Install @aws-sdk/client-s3 to use S3 uploader.');
  }

  const { S3Client, PutObjectCommand } = aws;

  const client = new S3Client({ region: opts.region || process.env.AWS_REGION });
  const bucket = opts.bucket || process.env.AWS_S3_BUCKET;
  const prefix = opts.prefix || '';

  if (!bucket) throw new Error('S3 uploader requires a bucket (opts.bucket or AWS_S3_BUCKET env)');

  return {
    async upload({ buffer, key, contentType = 'application/octet-stream' }) {
      const path = `${prefix}${key}`;
      const cmd = new PutObjectCommand({ Bucket: bucket, Key: path, Body: buffer, ContentType: contentType });
      await client.send(cmd);
      return { url: `s3://${bucket}/${path}` };
    }
  };
}
