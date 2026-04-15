import chalk from 'chalk';
import ora from 'ora';

const BRAND = chalk.hex('#FF6B35').bold('snap-asset');
const VERSION = '0.1.0';

export function banner() {
  console.log();
  console.log(`  ${BRAND} ${chalk.dim(`v${VERSION}`)}`);
  console.log();
}

export function info(label, value) {
  console.log(`  ${chalk.dim(label.padEnd(12))} ${value}`);
}

export function success(message) {
  console.log(`  ${chalk.green('✓')} ${message}`);
}

export function warn(message) {
  console.log(`  ${chalk.yellow('⚠')} ${message}`);
}

export function error(message) {
  console.log(`  ${chalk.red('✗')} ${message}`);
}

export function saved(filePath, sizeKb) {
  const size = sizeKb < 1024
    ? `${Math.round(sizeKb)} KB`
    : `${(sizeKb / 1024).toFixed(1)} MB`;
  console.log(`  ${chalk.green('saved')}  ${chalk.white(filePath)}  ${chalk.dim(`(${size})`)}`);
}

export function savings(format, pngKb, fmtKb) {
  const pct = Math.round((1 - fmtKb / pngKb) * 100);
  console.log(`  ${chalk.dim(`${format} saved ${pct}% vs PNG`)}`);
}

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
