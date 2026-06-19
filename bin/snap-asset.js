#!/usr/bin/env node

import { Command } from 'commander';
import { resolve } from 'path';
import chalk from 'chalk';
import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

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

const VIEWPORT_PRESETS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  wide: { width: 1920, height: 1080 },
};

function collectPlugins(value, previous) {
  return previous.concat([value]);
}

const program = new Command();

program
  .name('snap-asset')
  .description('Capture web screenshots & extract site assets as optimized PNG+WebP+AVIF')
  .version(pkg.version);

// Global options
program
  .option('--json', 'Output machine-readable JSON')
  .option('--verbose', 'Enable verbose logging')
  .option('--quiet', 'Quiet mode (suppress spinners)')
  .option('--no-sandbox', 'disable sandbox for CI environments')
  .option('--user-agent <string>', 'override browser user agent')
  .option('--timestamp', 'append timestamp to output filename')
  .option('--viewport <name>', 'device preset: mobile (375x812), tablet (768x1024), desktop (1280x800), wide (1920x1080)')
  .option('--proxy <url>', 'HTTP proxy URL')
  .option('--plugin <path>', 'path to a plugin JS file (repeatable)', collectPlugins, [])
  .option('--debug', 'Enable debug output with timing and stack traces');

// Apply global logger config before any action runs
program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.opts();
  log.setConfig({ json: !!opts.json, verbose: !!opts.verbose, quiet: !!opts.quiet, debug: !!opts.debug });
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
  .option('--cookies-file <path>', '[deprecated: use --cookies] Path to JSON file with cookies array')
  .option('--auth <credentials>', 'HTTP authentication (username:password)')
  .option('--pdf', 'capture as PDF instead of screenshot')
  .option('--pdf-format <format>', 'PDF paper format (A4, Letter, etc.)', 'A4')
  .option('--pdf-landscape', 'PDF landscape orientation')
  .option('--pdf-margin <margin>', 'PDF margin (e.g. 1cm)', '1cm')
  .option('--pdf-scale <n>', 'PDF scale factor (0.1-2)', parseFloat, 1)
  .option('--record-video', 'record a video of the page capture')
  .option('--css <code>', 'inject CSS into the page')
  .option('--wait-for-selector <selector>', 'wait for a CSS selector before capture')
  .option('--before-capture <json>', 'JSON array of interaction actions (click, type, hover, wait, screenshot)')
  .option('--device <name>', 'Playwright device name (e.g. "iPhone 15", "Pixel 7")')
  .option('--locale <locale>', 'browser locale (e.g. en-US, fr-FR)')
  .option('--timezone <timezone>', 'browser timezone (e.g. America/New_York)')
  .option('--geolocation <lat,lon>', 'geolocation coordinates (e.g. "40.7128,-74.0060")')
  .option('--color-scheme <scheme>', 'color scheme: light, dark, no-preference')
  .option('--capture-console', 'capture console log messages')
  .option('--collect-metrics', 'collect performance metrics')
  .option('--accessibility', 'capture accessibility snapshot')
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
      const debug = !!progOpts.debug;

      if (progOpts.viewport && VIEWPORT_PRESETS[progOpts.viewport]) {
        opts.width = VIEWPORT_PRESETS[progOpts.viewport].width;
        opts.height = VIEWPORT_PRESETS[progOpts.viewport].height;
      }

      validateFormat(opts.format);
      if (opts.quality !== undefined && (isNaN(opts.quality) || opts.quality < 1 || opts.quality > 100)) {
        throw new Error('Quality must be an integer between 1 and 100');
      }
      async function captureOne(url, index) {
        const usePdf = opts.pdf;

        if (usePdf && opts.selector) {
          log.warn('--selector is ignored in PDF mode. Use --full-page for full-page capture.');
        }

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

        if (debug) {
          log.debug('captureUrl options: ' + JSON.stringify({
            url,
            width: opts.width,
            height: opts.height,
            scale: opts.scale,
            selector: opts.selector,
            fullPage: opts.fullPage,
            clip: validateClip(opts.clip),
            wait: opts.wait,
            dark: opts.dark,
            cookies: cookies ? '<set>' : undefined,
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
            auth: auth ? '<set>' : undefined,
            recordVideo: opts.recordVideo,
            css: opts.css,
            waitForSelector: opts.waitForSelector,
            beforeCapture: opts.beforeCapture,
            device: opts.device,
            locale: opts.locale,
            timezone: opts.timezone,
            geolocation: opts.geolocation,
            colorScheme: opts.colorScheme,
            captureConsole: opts.captureConsole,
            collectMetrics: opts.collectMetrics,
            accessibility: opts.accessibility,
          }, null, 2));
        }

        const tCapture = Date.now();
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
          recordVideo: opts.recordVideo,
          css: opts.css,
          waitForSelector: opts.waitForSelector,
          beforeCapture: opts.beforeCapture
            ? (() => {
              try {
                const parsed = JSON.parse(opts.beforeCapture);
                if (!Array.isArray(parsed)) {
                  throw new Error('beforeCapture must be a JSON array');
                }
                return parsed;
              } catch (e) {
                throw new Error(`Invalid --before-capture JSON: ${e.message}`);
              }
            })()
            : undefined,
          device: opts.device,
          locale: opts.locale,
          timezone: opts.timezone,
          geolocation: opts.geolocation
            ? ((parts) => {
              if (parts.length !== 2 || parts.some((n) => isNaN(n))) {
                throw new Error('Invalid geolocation. Expected format: latitude,longitude (e.g. "40.7128,-74.0060")');
              }
              return { latitude: parts[0], longitude: parts[1] };
            })(opts.geolocation.split(',').map(Number))
            : undefined,
          colorScheme: opts.colorScheme,
          captureConsole: opts.captureConsole,
          collectMetrics: opts.collectMetrics,
          accessibility: opts.accessibility,
        });
        if (debug) log.debug(`captureUrl: ${Date.now() - tCapture}ms`);

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

        const tProcess = Date.now();
        let result = await processScreenshot(captureResult.buffer, {
          quality: opts.quality,
          resize: validateResize(opts.resize),
        });
        if (debug) log.debug(`processScreenshot: ${Date.now() - tProcess}ms`);

        if (opts.watermarkText) {
          const tWatermark = Date.now();
          const wb = await applyWatermark(result.png, opts.watermarkText);
          result = await processScreenshot(wb, {
            quality: opts.quality,
            resize: validateResize(opts.resize),
          });
          if (debug) log.debug(`watermark: ${Date.now() - tWatermark}ms`);
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
          const { path, size } = await savePdf(entry.pdfBuffer, entry.paths.pdfPath);
          log.saved(path, size / 1024);
          log.info('Captured PDF', entry.url);
          log.divider();
        } else {
          const { paths, result, url } = entry;
          const savedAssets = await saveAssets(paths, result);
          for (const { path, size } of savedAssets) {
            log.saved(path, size / 1024);
          }
          if (result.pngSize && result.webpSize) {
            log.savings('WebP', result.pngSize / 1024, result.webpSize / 1024);
          }
          if (result.pngSize && result.avifSize) {
            log.savings('AVIF', result.pngSize / 1024, result.avifSize / 1024);
          }
          if (paths.metadataPath) {
            await saveMetadata(paths, {
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
      const progOpts = program.opts();
      if (progOpts.debug) log.debug(err.stack);
      if (err.message && err.message.includes('browserType.launch')) {
        log.error('Browser not found. Run `npx playwright install chromium` to install Playwright browsers.');
      } else {
        log.error(err.message);
      }
      process.exit(1);
    }
  });

// ── Serve command: start HTTP server ─────────────────────────────────────────
program
  .command('serve')
  .description('Start an HTTP server for interactive capture')
  .option('--port <n>', 'port to listen on', parseInt, 3000)
  .option('--host <host>', 'host to bind to', '0.0.0.0')
  .action(async (opts) => {
    const { startServer } = await import('../src/serve.js');
    const progOpts = program.opts();
    const debug = !!progOpts.debug;

    const plugins = [];
    if (progOpts.plugin && progOpts.plugin.length > 0) {
      const { PluginManager } = await import('../src/plugin.js');
      const pm = new PluginManager();
      for (const pluginPath of progOpts.plugin) {
        try {
          const mod = await import(resolve(process.cwd(), pluginPath));
          const plugin = mod.default || mod;
          pm.registerPlugin(plugin);
          plugins.push(plugin);
        } catch (err) {
          if (err.code === 'ENOENT') {
            log.error(`Plugin not found: ${pluginPath}`);
            process.exit(1);
          }
          throw err;
        }
      }
      log.info('Plugins', plugins.map((p) => p.name).join(', '));
    }

    log.banner();
    log.info('Starting server', `http://${opts.host}:${opts.port}`);
    log.divider();

    try {
      const tStart = Date.now();
      const { server, close } = await startServer({ port: opts.port, host: opts.host });
      if (debug) log.debug(`server startup: ${Date.now() - tStart}ms`);
      log.success(`Server listening on http://${opts.host}:${opts.port}`);

      process.on('SIGINT', async () => {
        log.info('Shutting down...');
        await close();
        process.exit(0);
      });
      process.on('SIGTERM', async () => {
        log.info('Shutting down...');
        await close();
        process.exit(0);
      });
    } catch (err) {
      if (debug) log.debug(err.stack);
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
  .option('--css <code>', 'inject CSS into the page')
  .option('--wait-for-selector <selector>', 'wait for a CSS selector before capture')
  .option('--before-capture <json>', 'JSON array of interaction actions before capture')
  .option('--device <name>', 'Playwright device name (e.g. "iPhone 15", "Pixel 7")')
  .option('--locale <locale>', 'browser locale (e.g. en-US, fr-FR)')
  .option('--timezone <timezone>', 'browser timezone (e.g. America/New_York)')
  .option('--geolocation <lat,lon>', 'geolocation coordinates (e.g. "40.7128,-74.0060")')
  .option('--color-scheme <scheme>', 'color scheme: light, dark, no-preference')
  .action(async (componentPath, opts) => {
    const progOpts = program.opts();
    const debug = !!progOpts.debug;
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

      if (debug) {
        log.debug('captureUrl options: ' + JSON.stringify({
          url,
          width: opts.width,
          height: opts.height,
          scale: opts.scale,
          clip: validateClip(opts.clip),
          wait: opts.wait,
          dark: opts.dark,
          selector: '#root > *',
          cookies: cookies ? '<set>' : undefined,
          networkThrottling: opts.networkThrottle,
          waitForLazy: opts.waitForLazy,
          noSandbox: progOpts.noSandbox,
          userAgent: progOpts.userAgent,
          retries: opts.retries,
          css: opts.css,
          waitForSelector: opts.waitForSelector,
          beforeCapture: opts.beforeCapture,
          device: opts.device,
          locale: opts.locale,
          timezone: opts.timezone,
          geolocation: opts.geolocation,
          colorScheme: opts.colorScheme,
        }, null, 2));
      }

      const tCapture = Date.now();
      const captureResult = await captureUrl(url, {
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
        css: opts.css,
        waitForSelector: opts.waitForSelector,
        beforeCapture: opts.beforeCapture
          ? (() => {
            try {
              const parsed = JSON.parse(opts.beforeCapture);
              if (!Array.isArray(parsed)) {
                throw new Error('beforeCapture must be a JSON array');
              }
              return parsed;
            } catch (e) {
              throw new Error(`Invalid --before-capture JSON: ${e.message}`);
            }
          })()
          : undefined,
        device: opts.device,
        locale: opts.locale,
        timezone: opts.timezone,
        geolocation: opts.geolocation
          ? ((parts) => {
            if (parts.length !== 2 || parts.some((n) => isNaN(n))) {
              throw new Error('Invalid geolocation. Expected format: latitude,longitude (e.g. "40.7128,-74.0060")');
            }
            return { latitude: parts[0], longitude: parts[1] };
          })(opts.geolocation.split(',').map(Number))
          : undefined,
        colorScheme: opts.colorScheme,
      });
      if (debug) log.debug(`captureUrl: ${Date.now() - tCapture}ms`);

      validateFormat(opts.format);
      spin.text = 'Optimizing...';
      const tProcess = Date.now();
      const result = await processScreenshot(captureResult.buffer, { quality: opts.quality });
      if (debug) log.debug(`processScreenshot: ${Date.now() - tProcess}ms`);

      const outDir = opts.out || detectOutputDir();
      const name = safeName(opts.name || nameFromComponent(componentPath));
      const paths = resolveOutputPaths(outDir, name, {
        overwrite: opts.overwrite,
        format: opts.format,
        timestamp: progOpts.timestamp,
        metadata: opts.metadata,
      });

      const saved = await saveAssets(paths, result);
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
        await saveMetadata(paths, {
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
      if (debug) log.debug(err.stack);
      if (err.message && err.message.includes('browserType.launch')) {
        log.error('Browser not found. Run `npx playwright install chromium` to install Playwright browsers.');
      } else {
        log.error(err.message);
      }
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
    const progOpts = program.opts();
    const debug = !!progOpts.debug;
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

      if (debug) {
        log.debug('extractSiteAssets options: ' + JSON.stringify({
          url,
          width: opts.width,
          height: opts.height,
          scale: opts.scale,
          dark: opts.dark,
          sections: opts.sections !== false,
          images: opts.images !== false,
        }, null, 2));
      }

      const tExtract = Date.now();
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
      if (debug) log.debug(`extractSiteAssets: ${Date.now() - tExtract}ms`);

      spin.text = `Found ${assets.length} assets. Optimizing...`;

      const outDir = opts.out || resolve(detectOutputDir(), 'extracted');
      let savedCount = 0;

      for (const asset of assets) {
        try {
          if (asset.type === 'image' && !asset.buffer.length) {
            continue;
          }

          const tOpt = Date.now();
          const result = await processScreenshot(asset.buffer, { quality: opts.quality });
          if (debug) log.debug(`optimize ${asset.name}: ${Date.now() - tOpt}ms`);
          const paths = resolveOutputPaths(outDir, safeName(asset.name), {
            overwrite: opts.overwrite,
            format: 'both',
          });
          await saveAssets(paths, result);
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
      if (debug) log.debug(err.stack);
      if (err.message && err.message.includes('browserType.launch')) {
        log.error('Browser not found. Run `npx playwright install chromium` to install Playwright browsers.');
      } else {
        log.error(err.message);
      }
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
          let captureResult;

          if (capture.component) {
            const { url, cleanup } = await renderComponent(capture.component);
            try {
              captureResult = await captureUrl(url, {
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
                css: capture.css,
                waitForSelector: capture.waitForSelector,
                beforeCapture: capture.beforeCapture,
                device: capture.device,
                locale: capture.locale,
                timezone: capture.timezone,
                geolocation: capture.geolocation,
                colorScheme: capture.colorScheme,
              });
            } finally {
              cleanup();
            }
          } else {
            captureResult = await captureUrl(capture.url, {
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
              css: capture.css,
              waitForSelector: capture.waitForSelector,
              beforeCapture: capture.beforeCapture,
              device: capture.device,
              locale: capture.locale,
              timezone: capture.timezone,
              geolocation: capture.geolocation,
              colorScheme: capture.colorScheme,
            });
          }

          const result = await processScreenshot(captureResult.buffer, {
            quality: capture.quality || 80,
            resize: capture.resize,
          });

          const outDir = capture.out || detectOutputDir();
          const paths = resolveOutputPaths(outDir, safeName(capture.name), {
            overwrite: true,
            format: capture.format || 'both',
          });

          await saveAssets(paths, result);
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
