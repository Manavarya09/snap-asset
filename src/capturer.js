/* global document */

import { chromium } from 'playwright';
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
          if (img.dataset.src || img.dataset.lazySrc) {
            img.src = img.dataset.src || img.dataset.lazySrc;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
          if (img.complete) {
            resolve();
          }
        });
      }),
    );
  });
}

/**
 * @param {string} url
 * @param {CaptureOptions} [options]
 * @returns {Promise<Buffer>}
 */
export async function captureUrl(url, options = {}) {
  const cache =
    options.cache === false
      ? null
      : new DiskCache(process.cwd(), {
          maxEntries: options.cacheMaxEntries || 200,
          defaultTTL:
            options.cacheTTL || process.env.SNAP_ASSET_CACHE_TTL ? Number(process.env.SNAP_ASSET_CACHE_TTL) : 3600,
        });

  const cacheKey = `${url}|${JSON.stringify({ width: options.width, height: options.height, scale: options.scale, selector: options.selector, fullPage: options.fullPage, dark: options.dark, networkThrottling: options.networkThrottling })}`;
  if (cache) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
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
  } = options;

  const browser = await chromium.launch({ headless: true });

  try {
    const contextOptions = {
      viewport: { width, height },
      deviceScaleFactor: scale,
      colorScheme: dark ? 'dark' : 'light',
    };

    const context = await browser.newContext(contextOptions);

    if (options.cookies && Array.isArray(options.cookies)) {
      await context.addCookies(options.cookies);
    }

    if (headers && typeof headers === 'object') {
      await context.setExtraHTTPHeaders(headers);
    }

    const page = await context.newPage();

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

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout,
    });

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

    let buffer;

    if (selector) {
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

      if (options.clip) {
        screenshotOptions.clip = {
          x: options.clip.x,
          y: options.clip.y,
          width: options.clip.width,
          height: options.clip.height,
        };
        screenshotOptions.fullPage = false;
      }

      buffer = await page.screenshot(screenshotOptions);
    }

    if (cache) {
      await cache.set(cacheKey, buffer, { ttl: options.cacheTTL });
    }

    return buffer;
  } finally {
    await browser.close();
  }
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
