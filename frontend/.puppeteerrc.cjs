const { join } = require('path');

/**
 * Puppeteer config.
 *
 * Two distinct deploy targets, two different Chromium sources:
 *
 *   - LOCAL DEV  →  the regular `puppeteer` package downloads a full
 *                   Chromium build into `node_modules/.cache/puppeteer`.
 *                   `scripts/prerender.mjs` launches it normally.
 *   - VERCEL     →  the build runner is a minimal Linux container that
 *                   lacks the system libs Chromium needs (libnss3,
 *                   libatk-bridge2.0-0, etc.). We use
 *                   `@sparticuz/chromium` instead — a Chromium binary
 *                   with its deps statically linked, built for AWS
 *                   Lambda / Vercel / other minimal Linux runtimes.
 *
 * On Vercel we therefore SKIP puppeteer's own Chromium download — it
 * would (a) waste ~150 MB of build cache, (b) be the WRONG binary
 * anyway. Local installs still grab the bundled Chrome so developers
 * don't have to install one manually.
 *
 * The local cache lives inside `node_modules` (not the default
 * `~/.cache/puppeteer`) so Vercel's `node_modules` cache preserves it
 * across builds when developers temporarily run the prerender locally
 * in a Vercel-like env.
 */

const isVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

module.exports = {
  cacheDirectory: join(__dirname, 'node_modules', '.cache', 'puppeteer'),
  skipDownload: isVercel,
};
