const { join } = require('path');

/**
 * Puppeteer config.
 *
 * The default cache location (`~/.cache/puppeteer`) is NOT preserved
 * between Vercel builds, so Chromium would be redownloaded (~150 MB,
 * minutes of build time) on every deploy. Point the cache at a path
 * inside `node_modules/` instead — Vercel persists `node_modules`
 * between builds, so the binary downloads once and then sticks around.
 *
 * Local dev is unaffected: yarn re-uses the same `node_modules/.cache`
 * across runs.
 */
module.exports = {
  cacheDirectory: join(__dirname, 'node_modules', '.cache', 'puppeteer'),
};
