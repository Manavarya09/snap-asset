/* global document */

import { chromium, devices } from 'playwright';
import DiskCache from './cache.js';
import { resolve as resolvePath } from 'path';

/** @type {Object<string, {latency: number, downloadThroughput: number, uploadThroughput: number}>} */
const THROTTLE_PROFILES = {
  'fast-3g': { latency: 400, downloadThroughput: 400000, uploadThroughput: 400000 },
  'slow-3g': { latency: 400, downloadThroughput: 150000, uploadThroughput: 150000 },
};

/**
 * @typedef {Object} CaptureOptions
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [scale]
 * @property {string|null} [selector]
 * @property {boolean} [fullPage]
 * @property {number} [wait]
 * @property {boolean} [dark]
 * @property {number} [timeout]
 * @property {Object} [headers]
 * @property {string} [loginScript]
 * @property {string} [networkThrottling]
 * @property {boolean} [waitForLazy]
 * @property {Array<{name:string,value:string,domain?:string,path?:string}>} [cookies]
 * @property {{x:number,y:number,width:number,height:number}} [clip]
 * @property {boolean} [cache]
 * @property {number} [cacheMaxEntries]
 * @property {number} [cacheTTL]
 * @property {boolean} [noSandbox]
 * @property {string} [userAgent]
 * @property {number} [retries]
 * @property {boolean} [pdf]
 * @property {string} [pdfFormat]
 * @property {boolean} [pdfLandscape]
 * @property {string} [pdfMargin]
 * @property {number} [pdfScale]
 * @property {string} [proxy]
 * @property {{username:string, password:string}} [auth]
 * @property {boolean} [recordVideo]
 * @property {string} [css]
 * @property {string} [waitForSelector]
 * @property {number} [waitForTimeout]
 * @property {Array<{type:string, selector?:string, text?:string, ms?:number}>} [beforeCapture]
 * @property {string} [device]
 * @property {string} [locale]
 * @property {string} [timezone]
 * @property {{latitude:number, longitude:number}} [geolocation]
 * @property {'light'|'dark'|'no-preference'} [colorScheme]
 * @property {boolean} [captureConsole]
 * @property {boolean} [collectMetrics]
 * @property {boolean} [accessibility]
 *
 * @typedef {Object} Asset
 * @property {string} name
 * @property {Buffer} buffer
 * @property {string} type
 * @property {string} [originalSrc]
 *
 * @typedef {Object} ResponsiveResult
 * @property {number} width
 * @property {Buffer} buffer
 *
 * @typedef {Object} ExtractOptions
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [scale]
 * @property {boolean} [dark]
 * @property {boolean} [sections]
 * @property {boolean} [images]
 * @property {Array<{name:string,value:string,domain?:string,path?:string}>} [cookies]
 * @property {string} [loginScript]
 */

/**
 * @param {import('playwright').Page} page
 * @param {string} profile
 */
export async function setNetworkThrottling(page, profile) {
  if (!profile || profile === 'none' || !THROTTLE_PROFILES[profile]) {
    return;
  }
  const cdpSession = await page.context().newCDPSession(page);
  await cdpSession.send('Network.emulateNetworkConditions', {
    offline: false,
    ...THROTTLE_PROFILES[profile],
  });
}

/**
 * @param {import('playwright').Page} page
 */
export async function waitForLazyImages(page) {
  await page.evaluate(async () => {
    const images = Array.from(document.querySelectorAll('img[data-src], [data-lazy-src]'));
    await Promise.all(
      images.map((img) => {
        return new Promise((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          if (img.complete) {
            resolve();
            return;
          }
          if (img.dataset.src || img.dataset.lazySrc) {
            img.src = img.dataset.src || img.dataset.lazySrc;
          }
        });
      }),
    );
  });
}

/**
 * @param {string} url
 * @param {CaptureOptions & {retries?: number}} [options]
 * @returns {Promise<{buffer: Buffer, screenshots: Buffer[]}>}
 */
export async function captureUrl(url, options = {}) {
  const { retries = 2, ...rest } = options;

  if (typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://'))) {
    throw new Error(`Invalid URL: "${url}". Must start with http://, https://, or file://`);
  }

  const cacheTTL = typeof rest.cacheTTL === 'number' ? rest.cacheTTL
    : process.env.SNAP_ASSET_CACHE_TTL ? Number(process.env.SNAP_ASSET_CACHE_TTL)
    : 3600;

  const cache =
    rest.cache === false
      ? null
      : new DiskCache(process.cwd(), {
          maxEntries: rest.cacheMaxEntries || 200,
          defaultTTL: cacheTTL,
        });

  const captureKeyFields = {
    width: rest.width,
    height: rest.height,
    scale: rest.scale,
    selector: rest.selector,
    fullPage: rest.fullPage,
    dark: rest.dark,
    networkThrottling: rest.networkThrottling,
    pdf: rest.pdf,
    pdfFormat: rest.pdfFormat,
    pdfLandscape: rest.pdfLandscape,
    pdfMargin: rest.pdfMargin,
    pdfScale: rest.pdfScale,
    recordVideo: rest.recordVideo,
    css: rest.css,
    waitForSelector: rest.waitForSelector,
    device: rest.device,
    locale: rest.locale,
    timezone: rest.timezone,
    geolocation: rest.geolocation,
    colorScheme: rest.colorScheme,
    beforeCapture: rest.beforeCapture,
  };
  const cacheKey = `${url}|${JSON.stringify(captureKeyFields)}`;
  if (cache) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      return rest.pdf ? { pdf: cached, screenshots: [] } : { buffer: cached, screenshots: [] };
    }
  }

  const {
    width = 1280,
    height = 800,
    scale = 2,
    selector = null,
    fullPage = false,
    wait = 0,
    dark = false,
    timeout = 30000,
    headers = undefined,
    loginScript = undefined,
    networkThrottling = undefined,
    waitForLazy = false,
    noSandbox = false,
    userAgent = undefined,
    pdf = false,
    pdfFormat = 'A4',
    pdfLandscape = false,
    pdfMargin = '1cm',
    pdfScale = 1,
    proxy = undefined,
    auth = undefined,
    recordVideo = false,
    css = undefined,
    waitForSelector = undefined,
    waitForTimeout = undefined,
    beforeCapture = undefined,
    device = undefined,
    locale = undefined,
    timezone = undefined,
    geolocation = undefined,
    colorScheme = undefined,
  } = rest;

  const launchOptions = { headless: true };
  if (noSandbox) {
    launchOptions.args = ['--no-sandbox'];
  }
  if (proxy) {
    launchOptions.proxy = { server: proxy };
  }

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const browser = await chromium.launch(launchOptions);

      try {
        const contextOptions = {};

        if (device && devices[device]) {
          Object.assign(contextOptions, devices[device]);
        }

        contextOptions.viewport = { width, height };
        contextOptions.deviceScaleFactor = scale;
        contextOptions.colorScheme = colorScheme || (dark ? 'dark' : 'light');

        if (userAgent) {
          contextOptions.userAgent = userAgent;
        }
        if (locale) {
          contextOptions.locale = locale;
        }
        if (timezone) {
          contextOptions.timezoneId = timezone;
        }
        if (geolocation) {
          contextOptions.geolocation = geolocation;
          contextOptions.permissions = ['geolocation'];
        }

        if (recordVideo) {
          contextOptions.recordVideo = { dir: 'videos/' };
        }

        const context = await browser.newContext(contextOptions);

        if (rest.cookies && Array.isArray(rest.cookies)) {
          await context.addCookies(rest.cookies);
        }

        if (headers && typeof headers === 'object') {
          await context.setExtraHTTPHeaders(headers);
        }

        const page = await context.newPage();

        let pageCrashed = false;
        page.on('crash', () => {
          pageCrashed = true;
        });
        page.on('pageerror', (err) => {
          if (rest.captureConsole) {
            consoleEntries.push({ type: 'error', text: err.message, timestamp: Date.now() });
          }
        });

        const consoleEntries = [];
        if (rest.captureConsole) {
          page.on('console', (msg) => {
            consoleEntries.push({
              type: msg.type(),
              text: msg.text(),
              timestamp: Date.now(),
            });
          });
        }

        if (networkThrottling) {
          try {
            await setNetworkThrottling(page, networkThrottling);
          } catch {
            // Throttling best-effort
          }
        }

        if (loginScript) {
          try {
            const scriptPath = resolvePath(process.cwd(), loginScript);
            const mod = await import(scriptPath);
            if (typeof mod.default === 'function') {
              await mod.default({ page, context, playwright: { chromium } });
            } else if (typeof mod === 'function') {
              await mod({ page, context, playwright: { chromium } });
            }
          } catch {
            // Login script best-effort
          }
        }

        if (auth && auth.username && auth.password) {
          try {
            await page.authenticate(auth);
          } catch {
            // Auth best-effort
          }
        }

        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout,
        });

        if (pageCrashed) {
          throw new Error('Page crashed during navigation');
        }

        if (rest.cookies && Array.isArray(rest.cookies)) {
          try {
            await page.context().addCookies(rest.cookies);
          } catch {
            // Cookies best-effort
          }
        }

        if (waitForLazy) {
          try {
            await waitForLazyImages(page);
          } catch {
            // Lazy images best-effort
          }
        }

        if (wait > 0) {
          await page.waitForTimeout(wait);
        }

        if (css) {
          try {
            await page.addStyleTag({ content: css });
          } catch {
            // CSS injection best-effort
          }
        }

        if (waitForSelector) {
          try {
            await page.waitForSelector(waitForSelector, { timeout: 10000 });
          } catch {
            // waitForSelector best-effort
          }
        }

        if (waitForTimeout > 0) {
          await page.waitForTimeout(waitForTimeout);
        }

        const screenshots = [];
        if (Array.isArray(beforeCapture)) {
          for (const action of beforeCapture) {
            try {
              switch (action.type) {
                case 'click':
                  await page.click(action.selector);
                  break;
                case 'type':
                  await page.fill(action.selector, action.text);
                  break;
                case 'hover':
                  await page.hover(action.selector);
                  break;
                case 'wait':
                  await page.waitForTimeout(action.ms);
                  break;
                case 'screenshot':
                  screenshots.push(await page.screenshot({ type: 'png' }));
                  break;
              }
            } catch {
              // Action best-effort
            }
          }
        }

        let buffer;

        if (pdf) {
          buffer = await page.pdf({
            format: pdfFormat,
            landscape: pdfLandscape,
            margin: { top: pdfMargin, right: pdfMargin, bottom: pdfMargin, left: pdfMargin },
            scale: pdfScale,
            printBackground: true,
          });
        } else if (selector) {
          const element = page.locator(selector).first();
          await element.waitFor({ state: 'visible', timeout: 10000 });
          buffer = await element.screenshot({
            type: 'png',
            omitBackground: true,
          });
        } else {
          const screenshotOptions = {
            type: 'png',
            fullPage,
          };

          if (rest.clip) {
            screenshotOptions.clip = {
              x: rest.clip.x,
              y: rest.clip.y,
              width: rest.clip.width,
              height: rest.clip.height,
            };
            screenshotOptions.fullPage = false;
          }

          buffer = await page.screenshot(screenshotOptions);
        }

        let metrics;
        if (rest.collectMetrics && !pdf) {
          try {
            metrics = await page.evaluate(() => {
              const nav = performance.getEntriesByType('navigation')[0];
              if (!nav) return null;
              const paints = performance.getEntriesByType('paint');
              return {
                domContentLoaded: nav.domContentLoadedEventEnd,
                loadEventStart: nav.loadEventStart,
                domInteractive: nav.domInteractive,
                firstPaint: paints.find((p) => p.name === 'first-paint')?.startTime || null,
              };
            });
          } catch {
            // metrics best-effort
          }
        }

        let accessibilitySnapshot;
        if (rest.accessibility) {
          try {
            accessibilitySnapshot = await page.accessibility.snapshot();
          } catch {
            // accessibility best-effort
          }
        }

        if (cache) {
          try {
            await cache.set(cacheKey, buffer, { ttl: rest.cacheTTL });
          } catch {
            // Cache write best-effort
          }
        }

        const extra = {};
        if (rest.captureConsole) extra.consoleEntries = consoleEntries;
        if (rest.collectMetrics) extra.metrics = metrics;
        if (rest.accessibility) extra.accessibility = accessibilitySnapshot;

        if (recordVideo) {
          await context.close();
          const videoPath = context.videoPath() || null;
          return { buffer, videoPath, recorded: true, screenshots, ...extra };
        }

        return pdf
          ? { pdf: buffer, screenshots, ...extra }
          : { buffer, screenshots, ...extra };
      } finally {
        await browser.close();
      }
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * @param {string} url
 * @param {number[]} [widths]
 * @param {CaptureOptions} [options]
 * @returns {Promise<ResponsiveResult[]>}
 */
export async function captureResponsive(url, widths = [375, 768, 1024, 1280, 1920], options = {}) {
  const { height = 800, scale = 2, fullPage = false, wait = 0, dark = false } = options;

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: scale,
        colorScheme: dark ? 'dark' : 'light',
      });

      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      if (wait > 0) {
        await page.waitForTimeout(wait);
      }

      const buffer = await page.screenshot({ type: 'png', fullPage });
      results.push({ width, buffer });

      await context.close();
    }

    return results;
  } finally {
    await browser.close();
  }
}

/**
 * @param {string} url
 * @param {ExtractOptions} [options]
 * @returns {Promise<Asset[]>}
 */
export async function extractSiteAssets(url, options = {}) {
  const { width = 1280, height = 800, scale = 2, dark = false, sections = true, images = true } = options;

  const browser = await chromium.launch({ headless: true });
  /** @type {Asset[]} */
  const assets = [];

  try {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: scale,
      colorScheme: dark ? 'dark' : 'light',
    });

    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    const fullPageBuffer = await page.screenshot({ type: 'png', fullPage: true });
    assets.push({ name: 'full-page', buffer: fullPageBuffer, type: 'screenshot' });

    const viewportBuffer = await page.screenshot({ type: 'png' });
    assets.push({ name: 'viewport', buffer: viewportBuffer, type: 'screenshot' });

    if (sections) {
      /** @type {Array<{sel:string, name:string}>} */
      const sectionSelectors = [
        { sel: 'header, nav, [role="banner"]', name: 'header' },
        { sel: 'main > section:first-child, .hero, [class*="hero"], #hero', name: 'hero' },
        { sel: 'footer, [role="contentinfo"]', name: 'footer' },
        { sel: '[class*="feature"], [class*="Feature"], .features', name: 'features' },
        { sel: '[class*="pricing"], [class*="Pricing"], .pricing', name: 'pricing' },
        { sel: '[class*="testimonial"], [class*="Testimonial"]', name: 'testimonials' },
        { sel: '[class*="cta"], [class*="CTA"], [class*="call-to-action"]', name: 'cta' },
        { sel: '[class*="about"], [class*="About"]', name: 'about' },
        { sel: '[class*="contact"], [class*="Contact"]', name: 'contact' },
      ];

      for (const { sel, name } of sectionSelectors) {
        try {
          const el = page.locator(sel).first();
          const isVisible = await el.isVisible().catch(() => false);
          if (isVisible) {
            const buf = await el.screenshot({ type: 'png', omitBackground: true });
            assets.push({ name: `section-${name}`, buffer: buf, type: 'section' });
          }
        } catch {
          // Section not found
        }
      }

      const sectionCount = await page.locator('section').count();
      for (let i = 0; i < Math.min(sectionCount, 10); i++) {
        try {
          const el = page.locator('section').nth(i);
          const isVisible = await el.isVisible().catch(() => false);
          if (isVisible) {
            const buf = await el.screenshot({ type: 'png', omitBackground: true });
            assets.push({ name: `section-${i + 1}`, buffer: buf, type: 'section' });
          }
        } catch {
          // Section not found
        }
      }
    }

    if (images) {
      const imgSrcs = await page.evaluate(() => {
        const imgs = document.querySelectorAll('img[src]');
        return Array.from(imgs)
          .map((img, i) => ({
            src: img.src,
            alt: img.alt || `image-${i + 1}`,
            width: img.naturalWidth,
            height: img.naturalHeight,
          }))
          .filter((img) => img.width > 50 && img.height > 50);
      });

      for (const img of imgSrcs) {
        try {
          const response = await page.request.get(img.src);
          if (response.ok()) {
            const buf = await response.body();
            const safeNameStr =
              img.alt
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                .slice(0, 50) || 'image';
            assets.push({ name: `img-${safeNameStr}`, buffer: buf, type: 'image', originalSrc: img.src });
          }
        } catch {
          // Skip failed downloads
        }
      }
    }

    /** @type {Array<{sel:string, name:string}>} */
    const componentSelectors = [
      { sel: '[class*="card"], [class*="Card"]', name: 'card' },
      { sel: '[class*="button"], button:not([class*="close"])', name: 'button' },
      { sel: '[class*="modal"], [class*="Modal"], [role="dialog"]', name: 'modal' },
      { sel: '[class*="navbar"], [class*="Navbar"]', name: 'navbar' },
      { sel: '[class*="sidebar"], [class*="Sidebar"]', name: 'sidebar' },
    ];

    for (const { sel, name } of componentSelectors) {
      try {
        const count = await page.locator(sel).count();
        for (let i = 0; i < Math.min(count, 3); i++) {
          const el = page.locator(sel).nth(i);
          const isVisible = await el.isVisible().catch(() => false);
          const box = await el.boundingBox().catch(() => null);
          if (isVisible && box && box.width > 50 && box.height > 30) {
            const buf = await el.screenshot({ type: 'png', omitBackground: true });
            assets.push({ name: `component-${name}-${i + 1}`, buffer: buf, type: 'component' });
          }
        }
      } catch {
        // Component not found
      }
    }

    return assets;
  } finally {
    await browser.close();
  }
}
