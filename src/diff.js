import sharp from 'sharp';

/**
 * Create a side-by-side diff composite of two screenshots at 50% opacity.
 * @param {Buffer} buffer1
 * @param {Buffer} buffer2
 * @returns {Promise<Buffer>}
 */
export async function compareScreenshots(buffer1, buffer2) {
  if (!Buffer.isBuffer(buffer1) || !Buffer.isBuffer(buffer2)) {
    throw new Error('compareScreenshots requires valid Buffers');
  }
  const meta1 = await sharp(buffer1).metadata();
  const meta2 = await sharp(buffer2).metadata();

  const maxWidth = Math.max(meta1.width || 0, meta2.width || 0);
  const maxHeight = Math.max(meta1.height || 0, meta2.height || 0);

  const resized1 = await sharp(buffer1)
    .resize(maxWidth, maxHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const resized2 = await sharp(buffer2)
    .resize(maxWidth, maxHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: maxWidth * 2,
      height: maxHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      { input: resized1, top: 0, left: 0, blend: 'over', opacity: 0.5 },
      { input: resized2, top: 0, left: maxWidth, blend: 'over', opacity: 0.5 },
    ])
    .png()
    .toBuffer();
}

/**
 * Create a grid comparison from multiple image buffers.
 * @param {Buffer[]} buffers
 * @param {{columns?: number, gap?: number, background?: string}} [layout]
 * @returns {Promise<Buffer>}
 */
export async function createComparisonImage(buffers, layout = {}) {
  if (!buffers || buffers.length === 0) {
    throw new Error('At least one buffer is required');
  }

  const { columns = 2, gap = 2 } = layout;

  const metadatas = await Promise.all(buffers.map((b) => sharp(b).metadata()));
  const cellWidth = Math.max(...metadatas.map((m) => m.width || 0));
  const cellHeight = Math.max(...metadatas.map((m) => m.height || 0));

  const rows = Math.ceil(buffers.length / columns);
  const totalWidth = columns * cellWidth + (columns - 1) * gap;
  const totalHeight = rows * cellHeight + (rows - 1) * gap;

  const resized = await Promise.all(
    buffers.map((b) =>
      sharp(b)
        .resize(cellWidth, cellHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    ),
  );

  const composites = [];
  for (let i = 0; i < resized.length; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    composites.push({
      input: resized[i],
      top: row * (cellHeight + gap),
      left: col * (cellWidth + gap),
    });
  }

  return sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 4,
      background: layout.background || { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}
