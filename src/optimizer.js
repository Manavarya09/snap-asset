import sharp from 'sharp';

/**
 * Optimize a PNG buffer - reduce file size without quality loss.
 */
export async function optimizePng(buffer, options = {}) {
  const { resize = null } = options;

  let pipeline = sharp(buffer).png({
    compressionLevel: 9,
    adaptiveFiltering: true,
  });

  if (resize) {
    const [w, h] = resize.split('x').map(Number);
    pipeline = pipeline.resize(w, h, { fit: 'inside', withoutEnlargement: true });
  }

  return pipeline.toBuffer();
}

/**
 * Convert a PNG buffer to WebP.
 */
export async function toWebp(buffer, options = {}) {
  const { quality = 80, resize = null } = options;

  let pipeline = sharp(buffer).webp({ quality });

  if (resize) {
    const [w, h] = resize.split('x').map(Number);
    pipeline = pipeline.resize(w, h, { fit: 'inside', withoutEnlargement: true });
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
 * Process a screenshot buffer into optimized PNG + WebP.
 * Returns { png: Buffer, webp: Buffer, pngSize: number, webpSize: number }
 */
export async function processScreenshot(buffer, options = {}) {
  const [png, webp] = await Promise.all([
    optimizePng(buffer, options),
    toWebp(buffer, options),
  ]);

  return {
    png,
    webp,
    pngSize: png.length,
    webpSize: webp.length,
  };
}

/**
 * Get image metadata (width, height, format).
 */
export async function getMetadata(buffer) {
  return sharp(buffer).metadata();
}
