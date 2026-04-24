import { promises as fs } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

const CACHE_DIR = '.snap-asset-cache';
const INDEX_FILE = 'index.json';

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export default class DiskCache {
  constructor(root = process.cwd(), opts = {}) {
    this.root = root;
    this.dir = join(this.root, CACHE_DIR);
    this.indexPath = join(this.dir, INDEX_FILE);
    this.maxEntries = opts.maxEntries || 200;
    this.defaultTTL = typeof opts.defaultTTL === 'number' ? opts.defaultTTL : 3600; // seconds
    this.index = null;
  }

  async _loadIndex() {
    if (this.index) return this.index;
    try {
      const txt = await fs.readFile(this.indexPath, 'utf8');
      this.index = JSON.parse(txt);
    } catch {
      this.index = {};
    }
    return this.index;
  }

  async _saveIndex() {
    await ensureDir(this.dir);
    await fs.writeFile(this.indexPath, JSON.stringify(this.index || {}, null, 2), 'utf8');
  }

  async get(key) {
    const idx = await this._loadIndex();
    const id = hashKey(key);
    const meta = idx[id];
    if (!meta) return null;

    const now = Date.now();
    if (meta.expiresAt && now > meta.expiresAt) {
      await this._removeEntry(id);
      return null;
    }

    try {
      const buf = await fs.readFile(join(this.dir, id));
      // update mtime/access for LRU
      meta.lastAccess = now;
      idx[id] = meta;
      await this._saveIndex();
      return buf;
    } catch {
      // missing file
      delete idx[id];
      await this._saveIndex();
      return null;
    }
  }

  async set(key, buffer, opts = {}) {
    await ensureDir(this.dir);
    const idx = await this._loadIndex();
    const id = hashKey(key);
    const now = Date.now();
    const ttl = typeof opts.ttl === 'number' ? opts.ttl : this.defaultTTL;
    const meta = {
      key,
      size: Buffer.byteLength(buffer),
      createdAt: now,
      lastAccess: now,
      expiresAt: ttl > 0 ? now + ttl * 1000 : null,
    };

    await fs.writeFile(join(this.dir, id), buffer);
    idx[id] = meta;

    // Evict if we exceed maxEntries
    const ids = Object.keys(idx);
    if (ids.length > this.maxEntries) {
      // sort by lastAccess ascending (oldest first)
      const sorted = ids.sort((a, b) => (idx[a].lastAccess || 0) - (idx[b].lastAccess || 0));
      const toRemove = sorted.slice(0, ids.length - this.maxEntries);
      for (const r of toRemove) await this._removeEntry(r, idx);
    }

    await this._saveIndex();
  }

  async _removeEntry(id, idxRef) {
    const idx = idxRef || (await this._loadIndex());
    try {
      await fs.unlink(join(this.dir, id));
    } catch {}
    delete idx[id];
    await this._saveIndex();
  }

  async clear() {
    const idx = await this._loadIndex();
    for (const id of Object.keys(idx)) {
      try {
        await fs.unlink(join(this.dir, id));
      } catch {}
    }
    this.index = {};
    await this._saveIndex();
  }
}
