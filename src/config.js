import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CONFIG_NAME = 'snap-asset.config.json';
const VALID_FORMATS = ['png', 'webp', 'avif', 'both'];

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isResizeString(value) {
  return typeof value === 'string' && /^[1-9]\d*x[1-9]\d*$/.test(value);
}

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
}

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

  raw.captures.forEach((capture, index) => validateCapture(capture, index));
}

/**
 * Load snap-asset.config.json from the project root.
 * Returns merged config with defaults applied to each capture.
 */
export function loadConfig(cwd = process.cwd()) {
  const configPath = join(cwd, CONFIG_NAME);

  if (!existsSync(configPath)) {
    return null;
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  validateConfig(raw);

  const defaults = raw.defaults || {};
  const captures = (raw.captures || []).map(capture => ({
    ...defaults,
    ...capture,
  }));

  return { defaults, captures };
}

/**
 * Generate a starter config file.
 */
export function generateConfig(cwd = process.cwd()) {
  const configPath = join(cwd, CONFIG_NAME);

  if (existsSync(configPath)) {
    return { created: false, path: configPath };
  }

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
