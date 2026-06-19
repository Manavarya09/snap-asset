import sharp from 'sharp';

const OPTIMIZER_DEFAULTS = {
  pngCompressionLevel: 9,
  webpQuality: 80,
  avifQuality: 80,
  jpegQuality: 85,
  resizeKeepAspect: true,
  webpLossless: false,
};

/**
 * @typedef {Object} OptimizerOptions
 * @property {number} [quality]
 * @property {string} [resize]
 * @property {boolean} [lossless]
 *
 * @typedef {Object} ProcessResult
 * @property {Buffer} png
 * @property {Buffer} webp
 * @property {Buffer} avif
 * @property {Buffer} jpg
 * @property {number} pngSize
 * @property {number} webpSize
 * @property {number} avifSize
 * @property {number} jpgSize
 */

/**
 * @param {string|null|undefined} resize
 * @returns {{width:number,height:number}|null}
 */
function parseResize(resize) {
  if (!resize) {
    return null;
  }
  const match = /^([1-9]\d*)x([1-9]\d*)$/.exec(resize);
  if (!match) {
    throw new Error('Invalid resize value. Expected format WIDTHxHEIGHT, e.g. 800x600.');
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * @param {Buffer} buffer
 * @param {OptimizerOptions} [options]
 * @returns {Promise<Buffer>}
 */
export async function optimizePng(buffer, options = {}) {
  const { resize = null } = options;
  const dims = parseResize(resize);

  let pipeline = sharp(buffer).png({
    compressionLevel: 9,
    adaptiveFiltering: true,
  });

  if (dims) {
    pipeline = pipeline.resize(dims, { fit: 'inside', withoutEnlargement: true });
  }

  return pipeline.toBuffer();
}

/**
 * @param {Buffer} buffer
 * @param {OptimizerOptions} [options]
 * @returns {Promise<Buffer>}
 */
export async function toWebp(buffer, options = {}) {
  const {
    quality = OPTIMIZER_DEFAULTS.webpQuality,
    resize = null,
    lossless = OPTIMIZER_DEFAULTS.webpLossless,
  } = options;
  const dims = parseResize(resize);

  let pipeline = sharp(buffer).webp({ quality, lossless });

  if (dims) {
    pipeline = pipeline.resize(dims, { fit: 'inside', withoutEnlargement: true });
  }

  return pipeline.toBuffer();
}

/**
 * @param {Buffer} buffer
 * @param {OptimizerOptions} [options]
 * @returns {Promise<Buffer>}
 */
export async function toAvif(buffer, options = {}) {
  const { quality = OPTIMIZER_DEFAULTS.avifQuality, resize = null } = options;
  const dims = parseResize(resize);

  let pipeline = sharp(buffer).avif({ quality });

  if (dims) {
    pipeline = pipeline.resize(dims, { fit: 'inside', withoutEnlargement: true });
  }

  return pipeline.toBuffer();
}

/**
 * @param {Buffer} buffer
 * @param {OptimizerOptions} [options]
 * @returns {Promise<Buffer>}
 */
export async function toJpeg(buffer, options = {}) {
  const { quality = 85, resize = null } = options;

  let pipeline = sharp(buffer).jpeg({ quality, mozjpeg: true });

  if (resize) {
    const [w, h] = resize.split('x').map(Number);
    pipeline = pipeline.resize(w, h, { fit: 'inside', withoutEnlargement: true });
  }

  return pipeline.toBuffer();
}

/**
 * @param {Buffer} buffer
 * @param {OptimizerOptions} [options]
 * @returns {Promise<ProcessResult>}
 */
export async function processScreenshot(buffer, options = {}) {
  const [png, webp, avif, jpg] = await Promise.all([
    optimizePng(buffer, options),
    toWebp(buffer, options),
    toAvif(buffer, options),
    toJpeg(buffer, options),
  ]);

  return {
    png,
    webp,
    avif,
    jpg,
    pngSize: png.length,
    webpSize: webp.length,
    avifSize: avif.length,
    jpgSize: jpg.length,
  };
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<sharp.Metadata>}
 */
export async function getMetadata(buffer) {
  return sharp(buffer).metadata();
}
