import { accessSync, constants } from 'node:fs';

/** @typedef {'png'|'webp'|'avif'|'jpeg'|'jpg'|'both'} ValidFormat */

const VALID_FORMATS = ['png', 'webp', 'avif', 'jpeg', 'jpg', 'both'];

/**
 * @param {string} format
 * @returns {string}
 */
export function validateFormat(format) {
  if (!VALID_FORMATS.includes(format)) {
    throw new Error(`Invalid format '${format}'. Expected one of: ${VALID_FORMATS.join(', ')}`);
  }
  return format;
}

/**
 * @param {string|null|undefined} resize
 * @returns {string|null}
 */
export function validateResize(resize) {
  if (!resize) {
    return null;
  }
  if (!/^[1-9]\d*x[1-9]\d*$/.test(resize)) {
    throw new Error('Invalid resize value. Expected WIDTHxHEIGHT, e.g. 800x600.');
  }
  return resize;
}

/**
 * @param {string|null|undefined} clip
 * @returns {{x:number,y:number,width:number,height:number}|null}
 */
export function validateClip(clip) {
  if (!clip) {
    return null;
  }
  const parts = clip.split(',').map(Number);
  if (parts.length !== 4 || parts.some((v) => !Number.isInteger(v) || v < 0)) {
    throw new Error('Invalid clip value. Expected x,y,width,height with non-negative integers.');
  }
  return {
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3],
  };
}

export function validateFile(path) {
  try {
    accessSync(path, constants.R_OK);
    return path;
  } catch {
    throw new Error(`File not found or not readable: ${path}`);
  }
}

/**
 * Parse newline-separated URL list, skipping comments and empty lines.
 * @param {string} content
 * @returns {string[]}
 */
export function parseUrlList(content) {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

/**
 * Load cookies from a JSON file path.
 * @param {string} [cookiesPath]
 * @returns {Promise<Array<{name:string,value:string,domain?:string,path?:string}>|undefined>}
 */
export async function loadCookies(cookiesPath) {
  if (!cookiesPath) return undefined;
  try {
    const { readFile } = await import('node:fs/promises');
    const txt = await readFile(cookiesPath, 'utf8');
    return JSON.parse(txt);
  } catch {
    return undefined;
  }
}

/**
 * Parse a "username:password" auth string.
 * @param {string} [authStr]
 * @returns {{username:string,password:string}|undefined}
 */
export function parseAuth(authStr) {
  if (!authStr) return undefined;
  const colonIdx = authStr.indexOf(':');
  if (colonIdx > 0) {
    return { username: authStr.slice(0, colonIdx), password: authStr.slice(colonIdx + 1) };
  }
  return undefined;
}

/**
 * Parse a "latitude,longitude" geolocation string.
 * @param {string} [geolocationStr]
 * @returns {{latitude:number,longitude:number}|undefined}
 */
export function parseGeolocation(geolocationStr) {
  if (!geolocationStr) return undefined;
  const parts = geolocationStr.split(',').map(Number);
  if (parts.length !== 2 || parts.some((n) => isNaN(n))) {
    throw new Error('Invalid geolocation. Expected format: latitude,longitude (e.g. "40.7128,-74.0060")');
  }
  return { latitude: parts[0], longitude: parts[1] };
}
