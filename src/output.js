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

      if (!pngExists && !webpExists) {
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

  return result;
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

  return saved;
}
