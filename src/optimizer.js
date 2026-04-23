import sharp from 'sharp';

function parseResize(resize) {
  if (!resize) return null;
  const match = /^([1-9]\d*)x([1-9]\d*)$/.exec(resize);
  if (!match) {
    throw new Error('Invalid resize value. Expected format WIDTHxHEIGHT, e.g. 800x600.');
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * Optimize a PNG buffer - reduce file size without quality loss.
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
 * Convert a PNG buffer to WebP.
 */
export async function toWebp(buffer, options = {}) {
  const { quality = 80, resize = null } = options;
  const dims = parseResize(resize);

  let pipeline = sharp(buffer).webp({ quality });

  if (dims) {
    pipeline = pipeline.resize(dims, { fit: 'inside', withoutEnlargement: true });
  }

  return pipeline.toBuffer();
}

/**
 * Convert a PNG buffer to AVIF.
 */
export async function toAvif(buffer, options = {}) {
  const { quality = 50, resize = null } = options;
  const dims = parseResize(resize);

  let pipeline = sharp(buffer).avif({ quality });

  if (dims) {
    pipeline = pipeline.resize(dims, { fit: 'inside', withoutEnlargement: true });
  }

  return pipeline.toBuffer();
}

/**
 * Convert a PNG buffer to JPEG.
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
 * Process a screenshot buffer into optimized PNG + WebP + AVIF.
 * Returns { png: Buffer, webp: Buffer, avif: Buffer, pngSize: number, webpSize: number, avifSize: number }
 */
export async function processScreenshot(buffer, options = {}) {
  const [png, webp, avif] = await Promise.all([
    optimizePng(buffer, options),
    toWebp(buffer, options),
    toAvif(buffer, options),
  ]);

  return {
    png,
    webp,
    avif,
    pngSize: png.length,
    webpSize: webp.length,
    avifSize: avif.length,
  };
}

/**
 * Get image metadata (width, height, format).
 */
export async function getMetadata(buffer) {
  return sharp(buffer).metadata();
}
