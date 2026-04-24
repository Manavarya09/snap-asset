import { promises as fs } from 'fs';
import { resolve } from 'path';

async function createLocalUploader(opts = {}) {
  const dir = resolve(opts.dir || (process.cwd() + '/uploads'));
  await fs.mkdir(dir, { recursive: true });
  return {
    async upload({ buffer, key }) {
      const path = resolve(dir, key.replace(/[^a-z0-9.\-_/]/gi, '-'));
      await fs.writeFile(path, buffer);
      return { url: `file://${path}` };
    }
  };
}

export async function getUploader(opts = {}) {
  const type = (opts.type || process.env.SNAP_ASSET_UPLOADER || 'local').toLowerCase();
  if (type === 'mock') {
    return { async upload() { return { url: 'mock://uploaded' }; } };
  }

  if (type === 'local') return createLocalUploader(opts);

  if (type === 's3') {
    const create = await import('./uploaders/s3.js');
    return create.default(opts);
  }

  if (type === 'gcs' || type === 'gs') {
    const create = await import('./uploaders/gcs.js');
    return create.default(opts);
  }

  throw new Error(`Unknown uploader type: ${type}`);
}
