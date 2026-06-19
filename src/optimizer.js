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
    compressionLevel: OPTIMIZER_DEFAULTS.pngCompressionLevel,
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
  const { quality = OPTIMIZER_DEFAULTS.jpegQuality, resize = null } = options;
  const dims = parseResize(resize);

  let pipeline = sharp(buffer).jpeg({ quality, mozjpeg: true });

  if (dims) {
    pipeline = pipeline.resize(dims, { fit: 'inside', withoutEnlargement: true });
  }

  return pipeline.toBuffer();
}

/**
 * @param {Buffer} buffer
 * @param {OptimizerOptions} [options]
 * @returns {Promise<ProcessResult>}
 */
export async function processScreenshot(buffer, options = {}) {
  const { format } = options;
  const wantsAll = !format || format === 'both';

  const [png, webp, avif, jpg] = await Promise.all([
    wantsAll || format === 'png' ? optimizePng(buffer, options) : undefined,
    wantsAll || format === 'webp' ? toWebp(buffer, options) : undefined,
    wantsAll || format === 'avif' ? toAvif(buffer, options) : undefined,
    wantsAll || format === 'jpeg' || format === 'jpg' ? toJpeg(buffer, options) : undefined,
  ]);

  const result = {};
  if (png) { result.png = png; result.pngSize = png.length; }
  if (webp) { result.webp = webp; result.webpSize = webp.length; }
  if (avif) { result.avif = avif; result.avifSize = avif.length; }
  if (jpg) { result.jpg = jpg; result.jpgSize = jpg.length; }
  return result;
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<sharp.Metadata>}
 */
export async function getMetadata(buffer) {
  return sharp(buffer).metadata();
}
