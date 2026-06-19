import chalk from 'chalk';
import ora from 'ora';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const BRAND = chalk.hex('#FF6B35').bold('snap-asset');
const VERSION = pkg.version;

/** @type {{ enableColor: boolean, verbose: boolean, quiet: boolean, debug: boolean }} */
const CONFIG = {
  enableColor: true,
  verbose: false,
  quiet: false,
  debug: false,
};

/**
 * @param {{ enableColor?: boolean, verbose?: boolean, quiet?: boolean }} options
 */
export function setConfig(options) {
  Object.assign(CONFIG, options);
}

/** @returns {boolean} */
export function isQuiet() {
  return CONFIG.quiet;
}

export function banner() {
  console.log();
  console.log(`  ${BRAND} ${chalk.dim(`v${VERSION}`)}`);
  console.log();
}

/**
 * @param {string} label
 * @param {string} value
 */
export function info(label, value) {
  console.log(`  ${chalk.dim(label.padEnd(12))} ${value}`);
}

/** @param {string} message */
export function success(message) {
  console.log(`  ${chalk.green(message)}`);
}

/** @param {string} message */
export function warn(message) {
  console.log(`  ${chalk.yellow(message)}`);
}

/** @param {string} message */
export function error(message) {
  console.log(`  ${chalk.red(message)}`);
}

/** @param {string} message */
export function debug(message) {
  if (CONFIG.debug) {
    console.log(`  ${chalk.dim('[debug]')} ${chalk.dim(message)}`);
  }
}

/**
 * @param {string} filePath
 * @param {number} sizeKb
 */
export function saved(filePath, sizeKb) {
  const size = sizeKb < 1024 ? `${Math.round(sizeKb)} KB` : `${(sizeKb / 1024).toFixed(1)} MB`;
  console.log(`  ${chalk.green('saved')}  ${chalk.white(filePath)}  ${chalk.dim(`(${size})`)}`);
}

/**
 * @param {string} format
 * @param {number} pngKb
 * @param {number} fmtKb
 */
export function savings(format, pngKb, fmtKb) {
  const pct = Math.round((1 - fmtKb / pngKb) * 100);
  console.log(`  ${chalk.dim(`${format} saved ${pct}% vs PNG`)}`);
}

/** @param {string} text */
export function spinner(text) {
  return ora({
    text,
    prefixText: ' ',
    color: 'yellow',
  }).start();
}

export function divider() {
  console.log();
}

/** Simple async timer for debug timing. Returns elapsed ms. */
export function startTimer() {
  const start = Date.now();
  return (label) => {
    if (CONFIG.debug) {
      debug(`${label}: ${Date.now() - start}ms`);
    }
    return Date.now() - start;
  };
}
