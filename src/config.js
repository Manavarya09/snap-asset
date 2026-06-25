import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG_NAME = 'snap-asset.config.json';
const VALID_FORMATS = ['png', 'webp', 'avif', 'jpeg', 'jpg', 'both'];

/**
 * @typedef {Object} CaptureConfig
 * @property {string} name
 * @property {string} [url]
 * @property {string} [component]
 * @property {string} [selector]
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [scale]
 * @property {string} [format]
 * @property {number} [quality]
 * @property {string} [resize]
 * @property {boolean} [fullPage]
 * @property {boolean} [dark]
 * @property {number} [wait]
 * @property {string} [out]
 * @property {boolean} [waitForLazy]
 * @property {string} [networkThrottling]
 * @property {string} [css]
 * @property {string} [waitForSelector]
 * @property {Array<{type:string, selector?:string, text?:string, ms?:number}>} [beforeCapture]
 * @property {string} [device]
 * @property {string} [locale]
 * @property {string} [timezone]
 * @property {{latitude:number, longitude:number}} [geolocation]
 * @property {'light'|'dark'|'no-preference'} [colorScheme]
 *
 * @typedef {Object} DefaultsConfig
 * @property {string} [out]
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [scale]
 * @property {string} [format]
 * @property {number} [quality]
 *
 * @typedef {Object} RawConfig
 * @property {DefaultsConfig} [defaults]
 * @property {CaptureConfig[]} captures
 *
 * @typedef {Object} ResolvedConfig
 * @property {DefaultsConfig} defaults
 * @property {CaptureConfig[]} captures
 *
 * @typedef {Object} GenerateResult
 * @property {boolean} created
 * @property {string} path
 */

/**
 * @param {*} value
 * @returns {value is number}
 */
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

/**
 * @param {*} value
 * @returns {value is string}
 */
function isResizeString(value) {
  return typeof value === 'string' && /^[1-9]\d*x[1-9]\d*$/.test(value);
}

/**
 * @param {CaptureConfig} capture
 * @param {number} index
 */
function validateCapture(capture, index) {
  if (typeof capture !== 'object' || capture === null) {
    throw new Error(`capture[${index}] must be an object`);
  }

  if (!capture.name || typeof capture.name !== 'string') {
    throw new Error(`capture[${index}].name is required and must be a string`);
  }

  if (!capture.url && !capture.component) {
    throw new Error(`capture[${index}] requires either a url or component field`);
  }

  if (capture.url && typeof capture.url !== 'string') {
    throw new Error(`capture[${index}].url must be a string`);
  }

  if (capture.component && typeof capture.component !== 'string') {
    throw new Error(`capture[${index}].component must be a string`);
  }

  if (capture.selector && typeof capture.selector !== 'string') {
    throw new Error(`capture[${index}].selector must be a string`);
  }

  if (capture.width !== undefined && !isPositiveInteger(capture.width)) {
    throw new Error(`capture[${index}].width must be a positive integer`);
  }

  if (capture.height !== undefined && !isPositiveInteger(capture.height)) {
    throw new Error(`capture[${index}].height must be a positive integer`);
  }

  if (capture.scale !== undefined && !isPositiveInteger(capture.scale)) {
    throw new Error(`capture[${index}].scale must be a positive integer`);
  }

  if (capture.format !== undefined && !VALID_FORMATS.includes(capture.format)) {
    throw new Error(`capture[${index}].format must be one of ${VALID_FORMATS.join(', ')}`);
  }

  if (capture.quality !== undefined) {
    const quality = Number(capture.quality);
    if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
      throw new Error(`capture[${index}].quality must be an integer between 1 and 100`);
    }
  }

  if (capture.resize !== undefined && !isResizeString(capture.resize)) {
    throw new Error(`capture[${index}].resize must be a string like 800x600`);
  }

  if (capture.css !== undefined && typeof capture.css !== 'string') {
    throw new Error(`capture[${index}].css must be a string`);
  }

  if (capture.waitForSelector !== undefined && typeof capture.waitForSelector !== 'string') {
    throw new Error(`capture[${index}].waitForSelector must be a string`);
  }

  if (capture.colorScheme !== undefined && !['light', 'dark', 'no-preference'].includes(capture.colorScheme)) {
    throw new Error(`capture[${index}].colorScheme must be "light", "dark", or "no-preference"`);
  }

  if (capture.geolocation !== undefined) {
    if (typeof capture.geolocation !== 'object' || capture.geolocation === null) {
      throw new Error(`capture[${index}].geolocation must be an object with latitude and longitude`);
    }
    if (typeof capture.geolocation.latitude !== 'number' || typeof capture.geolocation.longitude !== 'number') {
      throw new Error(`capture[${index}].geolocation must have numeric latitude and longitude fields`);
    }
  }
}

/**
 * @param {RawConfig} raw
 */
export function validateConfig(raw) {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid configuration format');
  }

  if (raw.defaults !== undefined && typeof raw.defaults !== 'object') {
    throw new Error('defaults must be an object');
  }

  if (!Array.isArray(raw.captures)) {
    throw new Error('captures must be an array');
  }

  if (raw.batch !== undefined) {
    if (typeof raw.batch !== 'object' || raw.batch === null) {
      throw new Error('batch must be an object');
    }
    if (raw.batch.concurrency !== undefined && !isPositiveInteger(raw.batch.concurrency)) {
      throw new Error('batch.concurrency must be a positive integer');
    }
  }

  raw.captures.forEach((capture, index) => validateCapture(capture, index));
}

/**
 * @param {string} [cwd]
 * @returns {ResolvedConfig|null}
 */
export function loadConfig(cwd = process.cwd()) {
  const configPath = join(cwd, CONFIG_NAME);

  if (!existsSync(configPath)) {
    return null;
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch (parseErr) {
    throw new Error(`Failed to parse ${CONFIG_NAME}: ${parseErr.message}`, { cause: parseErr });
  }
  validateConfig(raw);

  const defaults = { ...(raw.defaults || {}) };
  const captures = (raw.captures || []).map((capture) => ({
    ...defaults,
    ...capture,
  }));

  return { defaults, captures };
}

/**
 * @param {string} [cwd]
 * @returns {GenerateResult}
 */
export function generateConfig(cwd = process.cwd()) {
  const configPath = join(cwd, CONFIG_NAME);

  if (existsSync(configPath)) {
    return { created: false, path: configPath };
  }

  mkdirSync(cwd, { recursive: true });

  const starter = {
    defaults: {
      out: 'public/screenshots',
      width: 1280,
      height: 800,
      scale: 2,
      format: 'both',
      quality: 80,
    },
    captures: [
      {
        name: 'hero',
        url: 'http://localhost:5173',
        selector: '.hero',
        _comment: 'Capture the hero section of your app',
      },
      {
        name: 'dashboard',
        url: 'http://localhost:5173/dashboard',
        fullPage: true,
        _comment: 'Full-page capture of dashboard',
      },
      {
        name: 'feature-card',
        url: 'http://localhost:5173',
        selector: '.feature-card',
        width: 400,
        height: 300,
        _comment: 'Capture a specific component',
      },
    ],
  };

  writeFileSync(configPath, JSON.stringify(starter, null, 2) + '\n');
  return { created: true, path: configPath };
}
