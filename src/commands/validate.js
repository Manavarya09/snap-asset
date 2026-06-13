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
