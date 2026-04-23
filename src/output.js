import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve, basename } from 'path';

/**
 * Auto-detect the best output directory in the project.
 * Checks: public/ > assets/ > static/ > ./screenshots/
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
 * Generate a safe filename from a name string.
 */
export function safeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'screenshot';
}

/**
 * Derive a name from a URL if no --name is provided.
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
 * Derive a name from a component file path.
 */
export function nameFromComponent(filePath) {
  const base = basename(filePath).replace(/\.(tsx?|jsx?|vue|svelte)$/, '');
  return safeName(base);
}

/**
 * Resolve the output path, avoiding overwrites.
 * Returns { pngPath, webpPath }
 */
export function resolveOutputPaths(outDir, name, options = {}) {
  const { overwrite = false, format = 'both' } = options;

  mkdirSync(outDir, { recursive: true });

  let finalName = name;

  if (!overwrite) {
    let counter = 0;
    while (true) {
      const suffix = counter === 0 ? '' : `-${counter}`;
      const testName = `${name}${suffix}`;
      const pngExists = existsSync(join(outDir, `${testName}.png`));
      const webpExists = existsSync(join(outDir, `${testName}.webp`));
      const avifExists = existsSync(join(outDir, `${testName}.avif`));
      const jpgExists = existsSync(join(outDir, `${testName}.jpg`));
      const jpegExists = existsSync(join(outDir, `${testName}.jpeg`));

      if (!pngExists && !webpExists && !avifExists && !jpgExists && !jpegExists) {
        finalName = testName;
        break;
      }
      counter++;
    }
  }

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
  if (format === 'jpeg' || format === 'jpg') {
    result.jpgPath = join(outDir, `${finalName}.jpg`);
  }

  return result;
}

/**
 * Generate an HTML <picture> element with WebP and PNG sources.
 * Provides modern format with fallback for older browsers.
 */
export function generatePictureHtml(name, options = {}) {
  const { alt = '', className = '', basePath = '' } = options;
  const prefix = basePath ? `${basePath}/` : '';
  const classAttr = className ? ` class="${className}"` : '';

  return [
    '<picture>',
    `  <source srcset="${prefix}${name}.avif" type="image/avif">`,
    `  <source srcset="${prefix}${name}.webp" type="image/webp">`,
    `  <img src="${prefix}${name}.png" alt="${alt}"${classAttr} loading="lazy">`,
    '</picture>',
  ].join('\n');
}

/**
 * Save buffers to disk.
 */
export function saveAssets(paths, buffers) {
  const saved = [];

  if (paths.pngPath && buffers.png) {
    writeFileSync(paths.pngPath, buffers.png);
    saved.push({ path: paths.pngPath, size: buffers.png.length });
  }

  if (paths.webpPath && buffers.webp) {
    writeFileSync(paths.webpPath, buffers.webp);
    saved.push({ path: paths.webpPath, size: buffers.webp.length });
  }

  if (paths.avifPath && buffers.avif) {
    writeFileSync(paths.avifPath, buffers.avif);
    saved.push({ path: paths.avifPath, size: buffers.avif.length });
  }

  if (paths.jpgPath && buffers.jpg) {
    writeFileSync(paths.jpgPath, buffers.jpg);
    saved.push({ path: paths.jpgPath, size: buffers.jpg.length });
  }

  return saved;
}
