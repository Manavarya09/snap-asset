import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import crypto from 'node:crypto';

const CACHE_DIR = '.snap-asset-cache';
const INDEX_FILE = 'index.json';

/**
 * @param {string} dir
 */
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

/**
 * @param {string} key
 * @returns {string}
 */
function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * @typedef {Object} CacheMeta
 * @property {string} key
 * @property {number} size
 * @property {number} createdAt
 * @property {number} lastAccess
 * @property {number|null} expiresAt
 *
 * @typedef {Object} CacheOptions
 * @property {number} [maxEntries]
 * @property {number} [defaultTTL]
 *
 * @typedef {Object} SetOptions
 * @property {number} [ttl]
 */

export default class DiskCache {
  /** @type {string} */ root;
  /** @type {string} */ dir;
  /** @type {string} */ indexPath;
  /** @type {number} */ maxEntries;
  /** @type {number} */ defaultTTL;
  /** @type {Object<string, CacheMeta>|null} */ index;

  /**
   * @param {string} [root]
   * @param {CacheOptions} [opts]
   */
  constructor(root = process.cwd(), opts = {}) {
    this.root = root;
    this.dir = join(this.root, CACHE_DIR);
    this.indexPath = join(this.dir, INDEX_FILE);
    this.maxEntries = opts.maxEntries || 200;
    this.defaultTTL = typeof opts.defaultTTL === 'number' ? opts.defaultTTL : 3600;
    this.index = null;
  }

  /**
   * @returns {Promise<Object<string, CacheMeta>>}
   */
  async _loadIndex() {
    if (this.index) {
      return this.index;
    }
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

  /**
   * @param {string} key
   * @returns {Promise<Buffer|null>}
   */
  async get(key) {
    const idx = await this._loadIndex();
    const id = hashKey(key);
    const meta = idx[id];
    if (!meta) {
      return null;
    }

    const now = Date.now();
    if (meta.expiresAt && now > meta.expiresAt) {
      await this._removeEntry(id);
      return null;
    }

    try {
      const buf = await fs.readFile(join(this.dir, id));
      meta.lastAccess = now;
      idx[id] = meta;
      await this._saveIndex();
      return buf;
    } catch {
      delete idx[id];
      await this._saveIndex();
      return null;
    }
  }

  /**
   * @param {string} key
   * @param {Buffer} buffer
   * @param {SetOptions} [opts]
   */
  async set(key, buffer, opts = {}) {
    await ensureDir(this.dir);
    const idx = await this._loadIndex();
    const id = hashKey(key);
    const now = Date.now();
    const ttl = typeof opts.ttl === 'number' ? opts.ttl : this.defaultTTL;
    /** @type {CacheMeta} */
    const meta = {
      key,
      size: Buffer.byteLength(buffer),
      createdAt: now,
      lastAccess: now,
      expiresAt: ttl > 0 ? now + ttl * 1000 : null,
    };

    await fs.writeFile(join(this.dir, id), buffer);
    idx[id] = meta;

    const ids = Object.keys(idx);
    if (ids.length > this.maxEntries) {
      const sorted = ids.sort((a, b) => (idx[a].lastAccess || 0) - (idx[b].lastAccess || 0));
      const toRemove = sorted.slice(0, ids.length - this.maxEntries);
      for (const r of toRemove) {
        await this._removeEntry(r, idx);
      }
    }

    await this._saveIndex();
  }

  /**
   * @param {string} id
   * @param {Object<string, CacheMeta>} [idxRef]
   */
  async _removeEntry(id, idxRef) {
    const idx = idxRef || (await this._loadIndex());
    try {
      await fs.unlink(join(this.dir, id));
    } catch {
      // File may have already been deleted
    }
    delete idx[id];
    await this._saveIndex();
  }

  async clear() {
    const idx = await this._loadIndex();
    for (const id of Object.keys(idx)) {
      try {
        await fs.unlink(join(this.dir, id));
      } catch {
        // File may have already been deleted
      }
    }
    this.index = {};
    await this._saveIndex();
  }
}
