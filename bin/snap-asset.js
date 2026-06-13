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
        'If the issue persists, run `npx playwright install chromium`.',
    );
    process.exit(1);
  }
  throw err;
}

import { processScreenshot } from '../src/optimizer.js';
import { applyWatermark } from '../src/watermark.js';
import { sendWebhook } from '../src/webhook.js';
import {
  detectOutputDir,
  resolveOutputPaths,
  saveAssets,
  savePdf,
  saveMetadata,
  safeName,
  nameFromUrl,
  nameFromComponent,
} from '../src/output.js';
import { loadConfig, generateConfig } from '../src/config.js';
import { renderComponent } from '../src/component-renderer.js';
import * as log from '../src/logger.js';
import { validateFormat, validateResize, validateClip, validateFile, parseUrlList } from '../src/commands/validate.js';
import pLimit from 'p-limit';

export { validateClip, validateFormat, validateResize };

const VIEWPORT_PRESETS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  wide: { width: 1920, height: 1080 },
};

const program = new Command();

program
  .name('snap-asset')
  .description('Capture web screenshots & extract site assets as optimized PNG+WebP+AVIF')
  .version('0.2.0');

// Global options
program
  .option('--json', 'Output machine-readable JSON')
  .option('--verbose', 'Enable verbose logging')
  .option('--quiet', 'Quiet mode (suppress spinners)')
  .option('--no-sandbox', 'disable sandbox for CI environments')
  .option('--user-agent <string>', 'override browser user agent')
  .option('--timestamp', 'append timestamp to output filename')
  .option('--viewport <name>', 'device preset: mobile (375x812), tablet (768x1024), desktop (1280x800), wide (1920x1080)')
  .option('--proxy <url>', 'HTTP proxy URL');

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
  .option('--wait-for-lazy', 'wait for lazy-loaded images before capture')
  .option('--network-throttle <profile>', 'simulate network conditions: fast-3g, slow-3g')
  .option('--no-cache', 'disable disk cache')
  .option('--metadata', 'save JSON metadata sidecar file')
  .option('--retries <n>', 'retry count for failed captures', parseInt, 2)
  .option('--watermark-text <text>', 'overlay text watermark on captured image')
  .option('--webhook-url <url>', 'send capture result to webhook URL')
  .option('--batch-file <path>', 'file with newline-separated URLs to capture')
  .option('--cookies-file <path>', 'Path to JSON file with cookies array')
  .option('--auth <credentials>', 'HTTP authentication (username:password)')
  .option('--pdf', 'capture as PDF instead of screenshot')
  .option('--pdf-format <format>', 'PDF paper format (A4, Letter, etc.)', 'A4')
  .option('--pdf-landscape', 'PDF landscape orientation')
  .option('--pdf-margin <margin>', 'PDF margin (e.g. 1cm)', '1cm')
  .option('--pdf-scale <n>', 'PDF scale factor (0.1-2)', parseFloat, 1)
  .action(async (urls, opts) => {
    if (opts.batchFile) {
      const content = validateFile(opts.batchFile);
      const fileContent = await import('fs').then((m) => m.promises.readFile(content, 'utf8'));
      urls = parseUrlList(fileContent);
    }

    if (!urls || urls.length === 0) {
      program.help();
      return;
    }

    log.banner();
    log.info('URLs', urls.join(', '));
    log.info('Viewport', `${opts.width}x${opts.height} @${opts.scale}x`);
    if (opts.selector) {
      log.info('Selector', opts.selector);
    }
    if (opts.dark) {
      log.info('Theme', 'dark');
    }
    log.divider();

    const spin = log.spinner('Launching browser...');

    try {
      const progOpts = program.opts();

      if (progOpts.viewport && VIEWPORT_PRESETS[progOpts.viewport]) {
        opts.width = VIEWPORT_PRESETS[progOpts.viewport].width;
        opts.height = VIEWPORT_PRESETS[progOpts.viewport].height;
      }

      validateFormat(opts.format);
      async function captureOne(url, index) {
        const usePdf = opts.pdf;

        let cookies = undefined;
        const cookiesPath = opts.cookies || opts.cookiesFile;
        if (cookiesPath) {
          try {
            const txt = await import('fs').then((m) => m.promises.readFile(cookiesPath, 'utf8'));
            cookies = JSON.parse(txt);
          } catch {
            // If cookies can't be read, proceed without them
          }
        }

        let auth = undefined;
        if (opts.auth) {
          const colonIdx = opts.auth.indexOf(':');
          if (colonIdx > 0) {
            auth = { username: opts.auth.slice(0, colonIdx), password: opts.auth.slice(colonIdx + 1) };
          }
        }

        spin.text = usePdf ? `Generating PDF for ${url}...` : `Capturing screenshot for ${url}...`;

        const captureResult = await captureUrl(url, {
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
          networkThrottling: opts.networkThrottle,
          waitForLazy: opts.waitForLazy,
          cache: opts.cache,
          noSandbox: progOpts.noSandbox,
          userAgent: progOpts.userAgent,
          retries: opts.retries,
          pdf: usePdf,
          pdfFormat: opts.pdfFormat,
          pdfLandscape: opts.pdfLandscape,
          pdfMargin: opts.pdfMargin,
          pdfScale: opts.pdfScale,
          proxy: progOpts.proxy,
          auth,
        });

        if (usePdf) {
          const outDir = opts.out || detectOutputDir();
          const name = safeName(
            opts.name && urls.length === 1
              ? opts.name
              : `${opts.name || nameFromUrl(url)}${urls.length > 1 ? `-${index + 1}` : ''}`,
          );
          const paths = resolveOutputPaths(outDir, name, {
            overwrite: opts.overwrite,
            format: 'pdf',
            timestamp: progOpts.timestamp,
          });
          return { paths, url, pdfBuffer: captureResult.pdf };
        }

        let result = await processScreenshot(captureResult, {
          quality: opts.quality,
          resize: validateResize(opts.resize),
        });

        if (opts.watermarkText) {
          const wb = await applyWatermark(result.png, opts.watermarkText);
          result = await processScreenshot(wb, {
            quality: opts.quality,
            resize: validateResize(opts.resize),
          });
        }

        const outDir = opts.out || detectOutputDir();
        const name = safeName(
          opts.name && urls.length === 1
            ? opts.name
            : `${opts.name || nameFromUrl(url)}${urls.length > 1 ? `-${index + 1}` : ''}`,
        );
        const paths = resolveOutputPaths(outDir, name, {
          overwrite: opts.overwrite,
          format: opts.format,
          timestamp: progOpts.timestamp,
          metadata: opts.metadata,
        });

        return { paths, result, url };
      }

      let results;
      if (opts.batchFile) {
        const limit = pLimit(3);
        results = await Promise.all(urls.map((url, i) => limit(() => captureOne(url, i))));
      } else {
        results = [];
        for (let index = 0; index < urls.length; index++) {
          results.push(await captureOne(urls[index], index));
        }
      }

      spin.stop();

      for (const entry of results) {
        if (entry.pdfBuffer) {
          const { path, size } = savePdf(entry.pdfBuffer, entry.paths.pdfPath);
          log.saved(path, size / 1024);
          log.info('Captured PDF', entry.url);
          log.divider();
        } else {
          const { paths, result, url } = entry;
          for (const { path, size } of saveAssets(paths, result)) {
            log.saved(path, size / 1024);
          }
          if (result.pngSize && result.webpSize) {
            log.savings('WebP', result.pngSize / 1024, result.webpSize / 1024);
          }
          if (result.pngSize && result.avifSize) {
            log.savings('AVIF', result.pngSize / 1024, result.avifSize / 1024);
          }
          if (paths.metadataPath) {
            saveMetadata(paths, {
              url,
              width: opts.width,
              height: opts.height,
              scale: opts.scale,
              pngSize: result.pngSize,
              webpSize: result.webpSize,
              avifSize: result.avifSize,
              jpgSize: result.jpgSize,
            });
          }
          log.info('Captured', url);
          log.divider();

          if (opts.webhookUrl) {
            const formats = ['png', 'webp', 'avif', 'jpg'].filter((f) => result[f]);
            sendWebhook(opts.webhookUrl, {
              url,
              timestamp: new Date().toISOString(),
              formats,
              size: Object.fromEntries(formats.map((f) => [f, result[`${f}Size`]])),
              metadata: {
                width: opts.width,
                height: opts.height,
                scale: opts.scale,
              },
            }).catch(() => {});
          }
        }
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
  .option('--wait-for-lazy', 'wait for lazy-loaded images before capture')
  .option('--network-throttle <profile>', 'simulate network conditions: fast-3g, slow-3g')
  .option('--no-cache', 'disable disk cache')
  .option('--metadata', 'save JSON metadata sidecar file')
  .option('--retries <n>', 'retry count for failed captures', parseInt, 2)
  .action(async (componentPath, opts) => {
    const progOpts = program.opts();
    log.banner();

    if (progOpts.viewport && VIEWPORT_PRESETS[progOpts.viewport]) {
      opts.width = VIEWPORT_PRESETS[progOpts.viewport].width;
      opts.height = VIEWPORT_PRESETS[progOpts.viewport].height;
    }

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
          const txt = await import('fs').then((m) => m.promises.readFile(opts.cookies, 'utf8'));
          cookies = JSON.parse(txt);
        } catch {
          // If cookies can't be read, proceed without them
        }
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
        networkThrottling: opts.networkThrottle,
        waitForLazy: opts.waitForLazy,
        cache: opts.cache,
        noSandbox: progOpts.noSandbox,
        userAgent: progOpts.userAgent,
        retries: opts.retries,
      });

      validateFormat(opts.format);
      spin.text = 'Optimizing...';
      const result = await processScreenshot(buffer, { quality: opts.quality });

      const outDir = opts.out || detectOutputDir();
      const name = safeName(opts.name || nameFromComponent(componentPath));
      const paths = resolveOutputPaths(outDir, name, {
        overwrite: opts.overwrite,
        format: opts.format,
        timestamp: progOpts.timestamp,
        metadata: opts.metadata,
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
      if (paths.metadataPath) {
        saveMetadata(paths, {
          url: url,
          width: opts.width,
          height: opts.height,
          scale: opts.scale,
          pngSize: result.pngSize,
          webpSize: result.webpSize,
          avifSize: result.avifSize,
          jpgSize: result.jpgSize,
        });
      }
      log.divider();
      log.success('Done!');
      log.divider();
    } catch (err) {
      spin.stop();
      log.error(err.message);
      process.exit(1);
    } finally {
      if (cleanup) {
        cleanup();
      }
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
          const txt = await import('fs').then((m) => m.promises.readFile(opts.cookies, 'utf8'));
          cookies = JSON.parse(txt);
        } catch {
          // If cookies can't be read, proceed without them
        }
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
          if (asset.type === 'image' && !asset.buffer.length) {
            continue;
          }

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
  .option('--retries <n>', 'retry count for failed captures', parseInt, 2)
  .action(async (opts) => {
    const progOpts = program.opts();
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

    const tasks = config.captures.map((capture, i) =>
      limit(async () => {
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
                networkThrottling: capture.networkThrottling,
                waitForLazy: capture.waitForLazy,
                noSandbox: progOpts.noSandbox,
                userAgent: progOpts.userAgent,
                retries: opts.retries,
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
              networkThrottling: capture.networkThrottling,
              waitForLazy: capture.waitForLazy,
              noSandbox: progOpts.noSandbox,
              userAgent: progOpts.userAgent,
              retries: opts.retries,
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
      }),
    );

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
      res = generateConfig();
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
