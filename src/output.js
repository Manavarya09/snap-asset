import { existsSync, mkdirSync } from 'fs';
import { writeFile, rm } from 'fs/promises';
import { join, basename } from 'path';

/**
 * @typedef {Object} OutputOptions
 * @property {boolean} [overwrite]
 * @property {string} [format]
 *
 * @typedef {Object} OutputPaths
 * @property {string} [pngPath]
 * @property {string} [webpPath]
 * @property {string} [avifPath]
 * @property {string} [jpgPath]
 * @property {string} [metadataPath]
 * @property {string} [pdfPath]
 *
 * @typedef {Object} BuffersMap
 * @property {Buffer} [png]
 * @property {Buffer} [webp]
 * @property {Buffer} [avif]
 * @property {Buffer} [jpg]
 *
 * @typedef {Object} SavedAsset
 * @property {string} path
 * @property {number} size
 *
 * @typedef {Object} CaptureInfo
 * @property {string} [url]
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [scale]
 * @property {number} [pngSize]
 * @property {number} [webpSize]
 * @property {number} [avifSize]
 * @property {number} [jpgSize]
 *
 * @typedef {Object} PictureOptions
 * @property {string} [alt]
 * @property {string} [className]
 * @property {string} [basePath]
 */

/**
 * @param {string} [cwd]
 * @returns {string}
 */
export function detectOutputDir(cwd = process.cwd()) {
  const candidates = ['public', 'assets', 'static'];

  for (const dir of candidates) {
    const fullPath = join(cwd, dir);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return join(cwd, 'screenshots');
}

/**
 * @param {string} name
 * @returns {string}
 */
export function safeName(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'screenshot'
  );
}

/**
 * @param {string} url
 * @returns {string}
 */
export function nameFromUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/|\/$/g, '');
    if (path) {
      return safeName(path.replace(/\//g, '-'));
    }
    return safeName(u.hostname.replace(/\./g, '-'));
  } catch {
    return 'screenshot';
  }
}

/**
 * @param {string} filePath
 * @returns {string}
 */
export function nameFromComponent(filePath) {
  const base = basename(filePath).replace(/\.(tsx?|jsx?|vue|svelte)$/, '');
  return safeName(base);
}

/**
 * @param {string} outDir
 * @param {string} name
 * @param {OutputOptions} [options]
 * @returns {OutputPaths}
 */
export function resolveOutputPaths(outDir, name, options = {}) {
  const { overwrite = false, format = 'both', timestamp = false, metadata = false } = options;

  mkdirSync(outDir, { recursive: true });

  let finalName = name;

  if (timestamp) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    finalName = `${finalName}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  if (!overwrite) {
    const formatExtensions = [];
    if (format === 'both' || format === 'png') formatExtensions.push('png');
    if (format === 'both' || format === 'webp') formatExtensions.push('webp');
    if (format === 'both' || format === 'avif') formatExtensions.push('avif');
    if (format === 'jpeg' || format === 'jpg') formatExtensions.push('jpg', 'jpeg');
    if (format === 'pdf') formatExtensions.push('pdf');

    let counter = 0;
    while (true) {
      const suffix = counter === 0 ? '' : `-${counter}`;
      const testName = `${name}${suffix}`;
      const anyExists = formatExtensions.some((ext) => existsSync(join(outDir, `${testName}.${ext}`)));

      if (!anyExists) {
        finalName = testName;
        break;
      }
      counter++;
    }
  }

  /** @type {OutputPaths} */
  const result = {};

  if (format === 'both' || format === 'png') {
    result.pngPath = join(outDir, `${finalName}.png`);
  }
  if (format === 'both' || format === 'webp') {
    result.webpPath = join(outDir, `${finalName}.webp`);
  }
  if (format === 'both' || format === 'avif') {
    result.avifPath = join(outDir, `${finalName}.avif`);
  }
  if (format === 'jpeg') {
    result.jpgPath = join(outDir, `${finalName}.jpeg`);
  } else if (format === 'jpg') {
    result.jpgPath = join(outDir, `${finalName}.jpg`);
  }
  if (format === 'pdf') {
    result.pdfPath = join(outDir, `${finalName}.pdf`);
  }

  if (metadata) {
    result.metadataPath = join(outDir, `${finalName}.json`);
  }

  return result;
}

/**
 * @param {string} name
 * @param {PictureOptions} [options]
 * @returns {string}
 */
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function generatePictureHtml(name, options = {}) {
  const { alt = '', className = '', basePath = '' } = options;
  const prefix = basePath ? `${basePath}/` : '';
  const safeAlt = escapeHtml(alt);
  const safeClass = escapeHtml(className);
  const classAttr = safeClass ? ` class="${safeClass}"` : '';

  return [
    '<picture>',
    `  <source srcset="${prefix}${name}.avif" type="image/avif">`,
    `  <source srcset="${prefix}${name}.webp" type="image/webp">`,
    `  <img src="${prefix}${name}.png" alt="${safeAlt}"${classAttr} loading="lazy">`,
    '</picture>',
  ].join('\n');
}

/**
 * @param {OutputPaths} paths
 * @param {BuffersMap} buffers
 * @returns {SavedAsset[]}
 */
export async function saveAssets(paths, buffers) {
  const saved = [];

  if (paths.pngPath && buffers.png) {
    await writeFile(paths.pngPath, buffers.png);
    saved.push({ path: paths.pngPath, size: buffers.png.length });
  }

  if (paths.webpPath && buffers.webp) {
    await writeFile(paths.webpPath, buffers.webp);
    saved.push({ path: paths.webpPath, size: buffers.webp.length });
  }

  if (paths.avifPath && buffers.avif) {
    await writeFile(paths.avifPath, buffers.avif);
    saved.push({ path: paths.avifPath, size: buffers.avif.length });
  }

  if (paths.jpgPath && buffers.jpg) {
    await writeFile(paths.jpgPath, buffers.jpg);
    saved.push({ path: paths.jpgPath, size: buffers.jpg.length });
  }

  return saved;
}

/**
 * @param {OutputPaths} paths
 * @param {CaptureInfo} info
 */
export async function saveMetadata(paths, info) {
  if (!paths.metadataPath) {
    return;
  }

  const metadata = {
    captured: new Date().toISOString(),
    url: info.url,
    width: info.width,
    height: info.height,
    scale: info.scale,
    formats: {},
  };

  if (paths.pngPath) {
    metadata.formats.png = { path: basename(paths.pngPath), size: info.pngSize };
  }
  if (paths.webpPath) {
    metadata.formats.webp = { path: basename(paths.webpPath), size: info.webpSize };
  }
  if (paths.avifPath) {
    metadata.formats.avif = { path: basename(paths.avifPath), size: info.avifSize };
  }
  if (paths.jpgPath) {
    metadata.formats.jpg = { path: basename(paths.jpgPath), size: info.jpgSize };
  }

  await writeFile(paths.metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * @param {Buffer} buffer
 * @param {string} filePath
 * @returns {{path: string, size: number}}
 */
export async function savePdf(buffer, filePath) {
  await writeFile(filePath, buffer);
  return { path: filePath, size: buffer.length };
}

/**
 * Recursively remove a directory.
 * @param {string} dirPath
 */
export async function cleanup(dirPath) {
  await rm(dirPath, { recursive: true, force: true });
}
