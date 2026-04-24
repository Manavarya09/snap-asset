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
import pLimit from 'p-limit';

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

function validateClip(clip) {
  if (!clip) return null;
  const parts = clip.split(',').map(Number);
  if (parts.length !== 4 || parts.some((v) => Number.isNaN(v) || v < 0)) {
    throw new Error('Invalid clip value. Expected x,y,width,height with non-negative integers.');
  }
  return {
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3],
  };
}

export { validateClip };

const program = new Command();

program
  .name('snap-asset')
  .description('Capture web screenshots & extract site assets as optimized PNG+WebP+AVIF')
  .version('0.1.0');

// Global options
program
  .option('--json', 'Output machine-readable JSON')
  .option('--verbose', 'Enable verbose logging')
  .option('--quiet', 'Quiet mode (suppress spinners)');

// Apply global logger config before any action runs
program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.opts();
  log.setConfig({ json: !!opts.json, verbose: !!opts.verbose, quiet: !!opts.quiet });
});

// ── Default command: capture one or more URLs ──────────────────────────────────────────
program
  .argument('[urls...]', 'URLs to capture')
  .option('--cookies <path>', 'Path to JSON file with cookies array to add')
  .option('--login-script <path>', 'Path to JS module that exports a default async login function (page)')
  .option('-n, --name <name>', 'output filename (without extension)')
  .option('-o, --out <dir>', 'output directory')
  .option('-s, --selector <css>', 'capture a specific CSS element')
  .option('-w, --width <px>', 'viewport width', parseInt, 1280)
  .option('-h, --height <px>', 'viewport height', parseInt, 800)
  .option('--scale <n>', 'device scale factor', parseInt, 2)
  .option('-f, --format <fmt>', 'output format: png, webp, avif, jpg, jpeg, both', 'both')
  .option('-q, --quality <n>', 'WebP/AVIF quality (1-100)', parseInt, 80)
  .option('--resize <WxH>', 'resize after capture (e.g. 800x600)')
  .option('--clip <x,y,width,height>', 'crop capture to a rectangular region')
  .option('--wait <ms>', 'wait before capture (ms)', parseInt, 0)
  .option('--dark', 'emulate dark color scheme')
  .option('--full-page', 'capture full scrollable page')
  .option('--overwrite', 'overwrite existing files')
  .action(async (urls, opts) => {
    if (!urls || urls.length === 0) {
      program.help();
      return;
    }

    log.banner();
    log.info('URLs', urls.join(', '));
    log.info('Viewport', `${opts.width}x${opts.height} @${opts.scale}x`);
    if (opts.selector) log.info('Selector', opts.selector);
    if (opts.dark) log.info('Theme', 'dark');
    log.divider();

    const spin = log.spinner('Launching browser...');

    try {
      validateFormat(opts.format);
      const results = [];
      for (let index = 0; index < urls.length; index++) {
        const url = urls[index];
        spin.text = `Capturing screenshot for ${url}...`;
        // load cookies file if provided
        let cookies = undefined;
        if (opts.cookies) {
          try {
            const txt = await import('fs').then(m => m.promises.readFile(opts.cookies, 'utf8'));
            cookies = JSON.parse(txt);
          } catch {}
        }

        const buffer = await captureUrl(url, {
          width: opts.width,
          height: opts.height,
          scale: opts.scale,
          selector: opts.selector,
          fullPage: opts.fullPage,
          clip: validateClip(opts.clip),
          wait: opts.wait,
          dark: opts.dark,
          cookies,
          loginScript: opts.loginScript,
        });

        const result = await processScreenshot(buffer, {
          quality: opts.quality,
          resize: validateResize(opts.resize),
        });

        const outDir = opts.out || detectOutputDir();
        const name = safeName(
          opts.name && urls.length === 1
            ? opts.name
            : `${opts.name || nameFromUrl(url)}${urls.length > 1 ? `-${index + 1}` : ''}`
        );
        const paths = resolveOutputPaths(outDir, name, {
          overwrite: opts.overwrite,
          format: opts.format,
        });

        results.push({ paths, result, url });
      }

      spin.stop();

      for (const { paths, result, url } of results) {
        for (const { path, size } of saveAssets(paths, result)) {
          log.saved(path, size / 1024);
        }
        if (result.pngSize && result.webpSize) {
          log.savings('WebP', result.pngSize / 1024, result.webpSize / 1024);
        }
        if (result.pngSize && result.avifSize) {
          log.savings('AVIF', result.pngSize / 1024, result.avifSize / 1024);
        }
        log.info('Captured', url);
        log.divider();
      }

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
  .option('--clip <x,y,width,height>', 'crop capture to a rectangular region')
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
      let cookies = undefined;
      if (opts.cookies) {
        try {
          const txt = await import('fs').then(m => m.promises.readFile(opts.cookies, 'utf8'));
          cookies = JSON.parse(txt);
        } catch {}
      }

      const buffer = await captureUrl(url, {
        width: opts.width,
        height: opts.height,
        scale: opts.scale,
        clip: validateClip(opts.clip),
        wait: opts.wait,
        dark: opts.dark,
        selector: '#root > *',
        cookies,
        loginScript: opts.loginScript,
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
      let cookies = undefined;
      if (opts.cookies) {
        try {
          const txt = await import('fs').then(m => m.promises.readFile(opts.cookies, 'utf8'));
          cookies = JSON.parse(txt);
        } catch {}
      }

      const assets = await extractSiteAssets(url, {
        width: opts.width,
        height: opts.height,
        scale: opts.scale,
        dark: opts.dark,
        sections: opts.sections !== false,
        images: opts.images !== false,
        cookies,
        loginScript: opts.loginScript,
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
  .option('--concurrency <n>', 'max concurrent captures', parseInt)
  .option('--cookies <path>', 'Path to JSON file with cookies array to add')
  .option('--login-script <path>', 'Path to JS module that exports a default async login function (page)')
  .action(async (opts) => {
    log.banner();

    const config = loadConfig(opts.config ? resolve(opts.config, '..') : undefined);
    if (!config) {
      log.error('No snap-asset.config.json found. Run `snap-asset init` to create one.');
      process.exit(1);
    }

    log.info('Captures', `${config.captures.length} defined`);
    log.divider();

    // Concurrency: limit concurrent captures to avoid resource exhaustion.
    const concurrency = (config.batch && config.batch.concurrency) || Number(process.env.SNAP_ASSET_CONCURRENCY) || 3;
    const limit = pLimit(concurrency);

    let completed = 0;
    let failed = 0;

    const total = config.captures.length;

    const tasks = config.captures.map((capture, i) => limit(async () => {
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
    }));

    await Promise.all(tasks);

    log.divider();
    log.success(`${completed} captured, ${failed} failed`);
    log.divider();
  });

// ── Init command: generate starter config ───────────────────────────────────
program
  .command('init')
  .description('Generate a starter snap-asset.config.json')
  .action(async () => {
    log.banner();

    let res;
    try {
      // Prefer interactive generation when available
      if (process.stdin.isTTY && process.stdout.isTTY) {
        res = await generateConfigInteractive();
      } else {
        res = generateConfig();
      }
    } catch (err) {
      log.error('Failed to create config: ' + err.message);
      process.exit(1);
    }

    const { created, path } = res;

    if (created) {
      log.success(`Created ${path}`);
      log.info('Next', 'Edit the config and run `snap-asset batch`');
    } else {
      log.warn(`Config already exists at ${path}`);
    }

    log.divider();
  });

program.parse();
