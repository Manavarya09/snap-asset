import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const CONFIG_NAME = 'snap-asset.config.json';

/**
 * Load snap-asset.config.json from the project root.
 * Returns merged config with defaults applied to each capture.
 */
export function loadConfig(cwd = process.cwd()) {
  const configPath = join(cwd, CONFIG_NAME);

  if (!existsSync(configPath)) {
    return null;
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
  const defaults = raw.defaults || {};
  const captures = (raw.captures || []).map(capture => ({
    ...defaults,
    ...capture,
  }));

  return { defaults, captures };
}

/**
 * Generate a starter config file.
 */
export function generateConfig(cwd = process.cwd()) {
  const configPath = join(cwd, CONFIG_NAME);

  if (existsSync(configPath)) {
    return { created: false, path: configPath };
  }

  const starter = {
    defaults: {
      out: 'public/screenshots',
      width: 1280,
      height: 800,
      scale: 2,
      format: 'both',
      quality: 80,
    },
    captures: [
      {
        name: 'hero',
        url: 'http://localhost:5173',
        selector: '.hero',
        _comment: 'Capture the hero section of your app',
      },
      {
        name: 'dashboard',
        url: 'http://localhost:5173/dashboard',
        fullPage: true,
        _comment: 'Full-page capture of dashboard',
      },
      {
        name: 'feature-card',
        url: 'http://localhost:5173',
        selector: '.feature-card',
        width: 400,
        height: 300,
        _comment: 'Capture a specific component',
      },
    ],
  };

  writeFileSync(configPath, JSON.stringify(starter, null, 2) + '\n');
  return { created: true, path: configPath };
}
