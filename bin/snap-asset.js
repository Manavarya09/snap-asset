#!/usr/bin/env node

import { Command } from 'commander';
import { resolve } from 'path';

let captureUrl, extractSiteAssets;
try {
  ({ captureUrl, extractSiteAssets } = await import('../src/capturer.js'));
} catch (err) {
  if (err.message.includes('playwright')) {
    console.error(
      'Error: Playwright is not installed.\n' +
      'Run `npm install` to install all dependencies, then try again.\n' +
      'If the issue persists, run `npx playwright install chromium`.'
    );
    process.exit(1);
  }
  throw err;
}

import { processScreenshot } from '../src/optimizer.js';
import {
  detectOutputDir,
  resolveOutputPaths,
  saveAssets,
  safeName,
  nameFromUrl,
  nameFromComponent,
} from '../src/output.js';
import { loadConfig, generateConfig } from '../src/config.js';
import { renderComponent } from '../src/component-renderer.js';
import * as log from '../src/logger.js';

const VALID_FORMATS = ['png', 'webp', 'avif', 'jpeg', 'jpg', 'both'];

function validateFormat(format) {
  if (!VALID_FORMATS.includes(format)) {
    throw new Error(`Invalid format '${format}'. Expected one of: ${VALID_FORMATS.join(', ')}`);
  }
  return format;
}

function validateResize(resize) {
  if (!resize) return null;
  if (!/^[1-9]\d*x[1-9]\d*$/.test(resize)) {
    throw new Error('Invalid resize value. Expected WIDTHxHEIGHT, e.g. 800x600.');
  }
  return resize;
}

const program = new Command();

program
  .name('snap-asset')
  .description('Capture web screenshots & extract site assets as optimized PNG+WebP+AVIF')
  .version('0.1.0');

// ── Default command: capture a URL ──────────────────────────────────────────
program
  .argument('[url]', 'URL to capture')
  .option('-n, --name <name>', 'output filename (without extension)')
  .option('-o, --out <dir>', 'output directory')
  .option('-s, --selector <css>', 'capture a specific CSS element')
  .option('-w, --width <px>', 'viewport width', parseInt, 1280)
  .option('-h, --height <px>', 'viewport height', parseInt, 800)
  .option('--scale <n>', 'device scale factor', parseInt, 2)
  .option('-f, --format <fmt>', 'output format: png, webp, avif, both', 'both')
  .option('-q, --quality <n>', 'WebP/AVIF quality (1-100)', parseInt, 80)
  .option('--resize <WxH>', 'resize after capture (e.g. 800x600)')
  .option('--wait <ms>', 'wait before capture (ms)', parseInt, 0)
  .option('--dark', 'emulate dark color scheme')
  .option('--full-page', 'capture full scrollable page')
  .option('--overwrite', 'overwrite existing files')
  .action(async (url, opts) => {
    if (!url) {
      program.help();
      return;
    }

    log.banner();
    log.info('URL', url);
    log.info('Viewport', `${opts.width}x${opts.height} @${opts.scale}x`);
    if (opts.selector) log.info('Selector', opts.selector);
    if (opts.dark) log.info('Theme', 'dark');
    log.divider();

    const spin = log.spinner('Launching browser...');

    try {
      spin.text = 'Capturing screenshot...';
      const buffer = await captureUrl(url, {
        width: opts.width,
        height: opts.height,
        scale: opts.scale,
        selector: opts.selector,
        fullPage: opts.fullPage,
        wait: opts.wait,
        dark: opts.dark,
      });

      spin.text = 'Optimizing...';
      validateFormat(opts.format);
      const result = await processScreenshot(buffer, {
        quality: opts.quality,
        resize: validateResize(opts.resize),
      });

      const outDir = opts.out || detectOutputDir();
      const name = safeName(opts.name || nameFromUrl(url));
      const paths = resolveOutputPaths(outDir, name, {
        overwrite: opts.overwrite,
        format: opts.format,
      });

      const saved = saveAssets(paths, result);
      spin.stop();

      log.divider();
      for (const { path, size } of saved) {
        log.saved(path, size / 1024);
      }

      if (result.pngSize && result.webpSize) {
        log.savings('WebP', result.pngSize / 1024, result.webpSize / 1024);
      }
      if (result.pngSize && result.avifSize) {
        log.savings('AVIF', result.pngSize / 1024, result.avifSize / 1024);
      }

      log.divider();
      log.success('Done!');
      log.divider();
    } catch (err) {
      spin.stop();
      log.error(err.message);
      process.exit(1);
    }
  });

// ── Component command: render + capture a component in isolation ─────────────
program
  .command('component <path>')
  .description('Capture a component rendered in isolation')
  .option('-n, --name <name>', 'output filename')
  .option('-o, --out <dir>', 'output directory')
  .option('-w, --width <px>', 'viewport width', parseInt, 800)
  .option('-h, --height <px>', 'viewport height', parseInt, 600)
  .option('--scale <n>', 'device scale factor', parseInt, 2)
  .option('-f, --format <fmt>', 'output format: png, webp, avif, both', 'both')
  .option('-q, --quality <n>', 'WebP/AVIF quality', parseInt, 80)
  .option('--dark', 'emulate dark color scheme')
  .option('--wait <ms>', 'wait before capture', parseInt, 500)
  .option('--overwrite', 'overwrite existing files')
  .action(async (componentPath, opts) => {
    log.banner();
    log.info('Component', componentPath);
    log.info('Viewport', `${opts.width}x${opts.height} @${opts.scale}x`);
    log.divider();

    const spin = log.spinner('Starting isolated render server...');
    let cleanup = null;

    try {
      const { url, cleanup: cleanupFn } = await renderComponent(componentPath, {
        projectRoot: process.cwd(),
      });
      cleanup = cleanupFn;

      spin.text = 'Capturing component...';
      const buffer = await captureUrl(url, {
        width: opts.width,
        height: opts.height,
        scale: opts.scale,
        wait: opts.wait,
        dark: opts.dark,
        selector: '#root > *',
      });

      validateFormat(opts.format);
      spin.text = 'Optimizing...';
      const result = await processScreenshot(buffer, { quality: opts.quality });

      const outDir = opts.out || detectOutputDir();
      const name = safeName(opts.name || nameFromComponent(componentPath));
      const paths = resolveOutputPaths(outDir, name, {
        overwrite: opts.overwrite,
        format: opts.format,
      });

      const saved = saveAssets(paths, result);
      spin.stop();

      log.divider();
      for (const { path, size } of saved) {
        log.saved(path, size / 1024);
      }
      if (result.pngSize && result.webpSize) {
        log.savings('WebP', result.pngSize / 1024, result.webpSize / 1024);
      }
      if (result.pngSize && result.avifSize) {
        log.savings('AVIF', result.pngSize / 1024, result.avifSize / 1024);
      }
      log.divider();
      log.success('Done!');
      log.divider();
    } catch (err) {
      spin.stop();
      log.error(err.message);
      process.exit(1);
    } finally {
      if (cleanup) cleanup();
    }
  });

// ── Extract command: scrape a website for all assets ────────────────────────
program
  .command('extract <url>')
  .description('Extract screenshots, sections, images & components from a website')
  .option('-o, --out <dir>', 'output directory')
  .option('-w, --width <px>', 'viewport width', parseInt, 1280)
  .option('-h, --height <px>', 'viewport height', parseInt, 800)
  .option('--scale <n>', 'device scale factor', parseInt, 2)
  .option('-q, --quality <n>', 'WebP quality', parseInt, 80)
  .option('--dark', 'emulate dark color scheme')
  .option('--no-sections', 'skip section screenshots')
  .option('--no-images', 'skip image extraction')
  .option('--overwrite', 'overwrite existing files')
  .action(async (url, opts) => {
    log.banner();
    log.info('Extract', url);
    log.info('Viewport', `${opts.width}x${opts.height} @${opts.scale}x`);
    log.divider();

    const spin = log.spinner('Scanning website...');

    try {
      const assets = await extractSiteAssets(url, {
        width: opts.width,
        height: opts.height,
        scale: opts.scale,
        dark: opts.dark,
        sections: opts.sections !== false,
        images: opts.images !== false,
      });

      spin.text = `Found ${assets.length} assets. Optimizing...`;

      const outDir = opts.out || resolve(detectOutputDir(), 'extracted');
      let savedCount = 0;

      for (const asset of assets) {
        try {
          if (asset.type === 'image' && !asset.buffer.length) continue;

          const result = await processScreenshot(asset.buffer, { quality: opts.quality });
          const paths = resolveOutputPaths(outDir, safeName(asset.name), {
            overwrite: opts.overwrite,
            format: 'both',
          });
          saveAssets(paths, result);
          savedCount++;
        } catch {
          // Skip assets that fail optimization (e.g., SVGs, tiny images)
        }
      }

      spin.stop();
      log.divider();
      log.success(`Extracted ${savedCount} assets to ${outDir}`);

      // Group by type
      const types = {};
      for (const a of assets) {
        types[a.type] = (types[a.type] || 0) + 1;
      }
      for (const [type, count] of Object.entries(types)) {
        log.info(type, `${count} found`);
      }

      log.divider();
    } catch (err) {
      spin.stop();
      log.error(err.message);
      process.exit(1);
    }
  });

// ── Batch command: run all captures from config ─────────────────────────────
program
  .command('batch')
  .description('Run all captures defined in snap-asset.config.json')
  .option('-c, --config <path>', 'config file path')
  .action(async (opts) => {
    log.banner();

    const config = loadConfig(opts.config ? resolve(opts.config, '..') : undefined);
    if (!config) {
      log.error('No snap-asset.config.json found. Run `snap-asset init` to create one.');
      process.exit(1);
    }

    log.info('Captures', `${config.captures.length} defined`);
    log.divider();

    let completed = 0;
    let failed = 0;

    const total = config.captures.length;

    for (let i = 0; i < total; i++) {
      const capture = config.captures[i];
      const progress = `[${i + 1}/${total}]`;
      const spin = log.spinner(`${progress} ${capture.name}...`);

      try {
        let buffer;

        if (capture.component) {
          const { url, cleanup } = await renderComponent(capture.component);
          try {
            buffer = await captureUrl(url, {
              width: capture.width || 1280,
              height: capture.height || 800,
              scale: capture.scale || 2,
              selector: '#root > *',
              wait: capture.wait || 500,
              dark: capture.dark,
            });
          } finally {
            cleanup();
          }
        } else {
          buffer = await captureUrl(capture.url, {
            width: capture.width || 1280,
            height: capture.height || 800,
            scale: capture.scale || 2,
            selector: capture.selector,
            fullPage: capture.fullPage,
            wait: capture.wait || 0,
            dark: capture.dark,
          });
        }

        const result = await processScreenshot(buffer, {
          quality: capture.quality || 80,
          resize: capture.resize,
        });

        const outDir = capture.out || detectOutputDir();
        const paths = resolveOutputPaths(outDir, safeName(capture.name), {
          overwrite: true,
          format: capture.format || 'both',
        });

        saveAssets(paths, result);
        spin.succeed(`${progress} ${capture.name} saved`);
        completed++;
      } catch (err) {
        spin.fail(`${progress} ${capture.name}: ${err.message}`);
        failed++;
      }
    }

    log.divider();
    log.success(`${completed} captured, ${failed} failed`);
    log.divider();
  });

// ── Init command: generate starter config ───────────────────────────────────
program
  .command('init')
  .description('Generate a starter snap-asset.config.json')
  .action(() => {
    log.banner();
    const { created, path } = generateConfig();

    if (created) {
      log.success(`Created ${path}`);
      log.info('Next', 'Edit the config and run `snap-asset batch`');
    } else {
      log.warn(`Config already exists at ${path}`);
    }

    log.divider();
  });

program.parse();
