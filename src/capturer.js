import { chromium } from 'playwright';

/**
 * Launch a headless browser and capture a screenshot.
 * Supports full-page, element-specific, and viewport captures.
 */
export async function captureUrl(url, options = {}) {
  const {
    width = 1280,
    height = 800,
    scale = 2,
    selector = null,
    fullPage = false,
    wait = 0,
    dark = false,
  } = options;

  const browser = await chromium.launch({ headless: true });

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
      buffer = await page.screenshot({
        type: 'png',
        fullPage,
      });
    }

    return buffer;
  } finally {
    await browser.close();
  }
}

/**
 * Capture a URL at multiple viewport widths for responsive testing.
 * Returns an array of { width, buffer } objects.
 */
export async function captureResponsive(url, widths = [375, 768, 1024, 1280, 1920], options = {}) {
  const {
    height = 800,
    scale = 2,
    fullPage = false,
    wait = 0,
    dark = false,
  } = options;

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
 * Extract all visible images and page sections from a website.
 * Returns an array of { name, buffer, type } objects.
 */
export async function extractSiteAssets(url, options = {}) {
  const {
    width = 1280,
    height = 800,
    scale = 2,
    dark = false,
    sections = true,
    images = true,
  } = options;

  const browser = await chromium.launch({ headless: true });
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

    // 1. Full page screenshot
    const fullPageBuffer = await page.screenshot({ type: 'png', fullPage: true });
    assets.push({ name: 'full-page', buffer: fullPageBuffer, type: 'screenshot' });

    // 2. Above-the-fold (viewport) screenshot
    const viewportBuffer = await page.screenshot({ type: 'png' });
    assets.push({ name: 'viewport', buffer: viewportBuffer, type: 'screenshot' });

    // 3. Extract section screenshots
    if (sections) {
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
          // Section not found, skip
        }
      }

      // Also capture all <section> elements by index
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
          // Skip
        }
      }
    }

    // 4. Extract images from the page
    if (images) {
      const imgSrcs = await page.evaluate(() => {
        const imgs = document.querySelectorAll('img[src]');
        return Array.from(imgs).map((img, i) => ({
          src: img.src,
          alt: img.alt || `image-${i + 1}`,
          width: img.naturalWidth,
          height: img.naturalHeight,
        })).filter(img => img.width > 50 && img.height > 50); // Skip tiny icons
      });

      for (const img of imgSrcs) {
        try {
          const response = await page.request.get(img.src);
          if (response.ok()) {
            const buf = await response.body();
            const safeName = img.alt
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
              .slice(0, 50) || 'image';
            assets.push({ name: `img-${safeName}`, buffer: buf, type: 'image', originalSrc: img.src });
          }
        } catch {
          // Skip failed downloads
        }
      }
    }

    // 5. Extract component-like elements (cards, buttons, etc.)
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
        // Skip
      }
    }

    return assets;
  } finally {
    await browser.close();
  }
}
