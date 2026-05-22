#!/usr/bin/env node
/**
 * prerender — static-site generation for the public marketing surfaces.
 *
 * After `vite build` writes `dist/`, this script:
 *
 *   1. Spawns a tiny in-process HTTP server that serves `dist/` and
 *      falls back to `dist/index.html` for SPA routes (mirrors what
 *      Vercel does in production).
 *   2. Launches headless Chromium via Puppeteer.
 *   3. For each public route in PRERENDER_ROUTES, navigates, waits for
 *      the page to fully hydrate (key DOM selector + network idle),
 *      then snapshots `document.documentElement.outerHTML`.
 *   4. Writes the snapshot to `dist/<route>/index.html` (or
 *      `dist/index.html` for `/`).
 *
 * Why a custom Puppeteer script instead of a plugin:
 *
 *   - The app reads `window.localStorage`, has multiple async
 *     providers (AuthProvider, SettingsProvider, I18nProvider) and a
 *     Supabase client. Real Chromium handles every browser API
 *     correctly; jsdom-based renderers do not.
 *   - Zero plugin magic — failures surface as readable Node errors,
 *     not opaque framework output.
 *   - Easy to extend: add a route, add an entry to PRERENDER_ROUTES.
 *
 * Auth bypass: before the app boots, this script injects
 * `window.__PRERENDER__ = true`. `<PublicRoute>` checks the flag and
 * renders its children immediately instead of waiting for a Supabase
 * `getSession()` response. Real users never have the flag, so runtime
 * behaviour is unchanged.
 */
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, '..', 'dist');
const PORT = Number(process.env.PRERENDER_PORT ?? 4319);
const ORIGIN = `http://127.0.0.1:${PORT}`;

/**
 * Static routes to prerender. Mirrors the public surfaces in
 * `src/lib/routes.ts` and `scripts/generate-sitemap.mjs`. Auth-form
 * pages and authenticated areas stay out (they're noindex anyway).
 */
const STATIC_ROUTES = [
  '/',
  '/register/student',
  '/register/teacher',
  '/blog',
];

// Blog posts — read from the JSON manifest so adding an article
// requires zero changes to this file.
const MANIFEST_PATH = resolve(__dirname, '..', 'src', 'content', 'blog', 'manifest.json');
let blogRoutes = [];
try {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  blogRoutes = (manifest.slugs ?? []).map((slug) => `/blog/${slug}`);
} catch (err) {
  console.warn(`[prerender] could not read ${MANIFEST_PATH} — skipping blog post prerender.`);
  console.warn(`[prerender] reason: ${err.message}`);
}

const PRERENDER_ROUTES = [...STATIC_ROUTES, ...blogRoutes];

// ---------------------------------------------------------------------
// Tiny static server (mirrors Vercel's static-first, SPA-fallback
// routing). Filesystem hit first, then `index.html` for unmatched
// paths — exactly the order Vercel resolves requests in production.
// ---------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico':  'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveFile(res, filePath) {
  const ext = extname(filePath).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
}

function startServer() {
  return new Promise((resolveStart) => {
    const server = createServer((req, res) => {
      // Strip query/hash — irrelevant for static dispatch.
      const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0].split('#')[0]);
      const direct = join(DIST_DIR, urlPath);

      // Try `<path>` as a file, then `<path>/index.html`, then root SPA.
      if (existsSync(direct) && statSync(direct).isFile()) {
        return serveFile(res, direct);
      }
      const asIndex = join(direct, 'index.html');
      if (existsSync(asIndex) && statSync(asIndex).isFile()) {
        return serveFile(res, asIndex);
      }
      return serveFile(res, join(DIST_DIR, 'index.html'));
    });
    server.listen(PORT, '127.0.0.1', () => resolveStart(server));
  });
}

// ---------------------------------------------------------------------
// Puppeteer launcher — two paths:
//
//   - LOCAL  → import full `puppeteer` (bundled Chrome works on macOS /
//              Linux dev machines that have GUI libs).
//   - VERCEL → import `puppeteer-core` (no bundled binary) plus
//              `@sparticuz/chromium`, whose statically-linked binary
//              runs on Vercel's minimal Linux build container which is
//              missing libnss3/libatk/etc.
//
// We pick based on env vars set by the host (VERCEL=1, AWS_LAMBDA_*).
// The same code path also covers any other minimal Linux CI (just set
// SPARTICUZ=1 explicitly).
// ---------------------------------------------------------------------
const IS_SERVERLESS =
  !!process.env.VERCEL ||
  !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.SPARTICUZ === '1';

async function loadPuppeteerAndLaunch(launchExtras = {}) {
  if (IS_SERVERLESS) {
    let chromium, puppeteer;
    try {
      const chromiumMod = await import('@sparticuz/chromium');
      chromium = chromiumMod.default ?? chromiumMod;
      // Disable WebGL / etc. that Chromium can't initialise on a
      // headless container. The library exposes a `setGraphicsMode`
      // hook on recent versions; ignore if not present.
      if (typeof chromium.setGraphicsMode === 'boolean') {
        chromium.setGraphicsMode = false;
      } else if (typeof chromium.setHeadlessMode !== 'undefined') {
        // older API surface — no-op, just don't crash.
      }
      // puppeteer is preferred (it re-exports puppeteer-core's API and
      // honours the same executablePath option). We use whichever one
      // is installed.
      try {
        const mod = await import('puppeteer');
        puppeteer = mod.default ?? mod;
      } catch {
        const mod = await import('puppeteer-core');
        puppeteer = mod.default ?? mod;
      }
    } catch (err) {
      console.error(
        '\n[prerender] @sparticuz/chromium is required for Vercel builds.',
      );
      console.error('  Install it with:  yarn add -D @sparticuz/chromium\n');
      throw err;
    }

    const executablePath = await chromium.executablePath();
    console.log(`[prerender] launching @sparticuz/chromium at ${executablePath}`);
    return puppeteer.launch({
      args: [
        ...chromium.args,
        // Belt-and-braces sandbox bypass for container envs that don't
        // expose the user-namespaces Chromium normally relies on.
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless ?? true,
      ...launchExtras,
    });
  }

  // Local dev path.
  let puppeteer;
  try {
    const mod = await import('puppeteer');
    puppeteer = mod.default ?? mod;
  } catch (err) {
    console.error('\n[prerender] puppeteer is not installed.');
    console.error('  Install it with:  yarn add -D puppeteer');
    console.error('  Then re-run:      yarn build\n');
    throw err;
  }

  // Honour a CHROME_PATH override so a contributor without the
  // bundled download can point at a system Chrome (e.g. Chromium
  // installed via Homebrew).
  const executablePath = process.env.CHROME_PATH || undefined;

  return puppeteer.launch({
    headless: 'new',
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    ...launchExtras,
  });
}

async function renderRoute(browser, route) {
  const page = await browser.newPage();

  // Set the prerender flag BEFORE the page scripts execute. This is
  // what unblocks <PublicRoute> from showing its auth-loading spinner
  // (see comment in src/App.tsx). Also raise a flag in localStorage so
  // any future code that needs to detect prerender has a synchronous
  // signal.
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(window, '__PRERENDER__', { value: true, writable: false });
    try { window.localStorage.setItem('__prerender__', '1'); } catch {}
  });

  // Match a realistic mobile UA so any device-aware code renders the
  // mobile-friendly variant (Google evaluates the mobile-rendered HTML
  // for ranking).
  await page.setUserAgent(
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 PrerenderBot',
  );
  await page.setViewport({ width: 414, height: 896, deviceScaleFactor: 2, isMobile: true });

  // Block outbound calls to Supabase — we don't want the prerender to
  // depend on the database being reachable, and we never want a real
  // session to leak into the captured HTML. Anything else loads
  // normally (assets from our own server).
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (/supabase\.co\//.test(url) || /supabase\.in\//.test(url)) {
      return req.abort();
    }
    return req.continue();
  });

  const url = `${ORIGIN}${route}`;
  console.log(`[prerender] → ${route}`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  // Wait for the React tree to actually populate <main>/<h1>. If the
  // selector never appears within the budget, fall back to whatever
  // HTML is on the page — better a partial snapshot than a failed
  // build. The fallback case still has the static SEO tags from
  // index.html so the route is no worse than the un-prerendered SPA.
  try {
    await page.waitForFunction(
      () => !!document.querySelector('h1') || !!document.querySelector('main'),
      { timeout: 15_000 },
    );
  } catch {
    console.warn(`[prerender]   no h1/main appeared within 15s — capturing current DOM`);
  }

  // Small idle window so the <Seo /> effect has a tick to write meta
  // tags into <head>.
  await new Promise((r) => setTimeout(r, 250));

  const html = await page.evaluate(() => {
    // Strip the prerender flag from the captured HTML so runtime code
    // on real visitors doesn't accidentally see it.
    return '<!doctype html>\n' + document.documentElement.outerHTML;
  });

  await page.close();
  return html;
}

function writeRouteHtml(route, html) {
  const out = route === '/'
    ? join(DIST_DIR, 'index.html')
    : join(DIST_DIR, route.replace(/^\/+/, ''), 'index.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html, 'utf8');
  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log(`[prerender]   wrote ${out.replace(DIST_DIR, 'dist')}  (${kb} kB)`);
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------
async function main() {
  if (!existsSync(DIST_DIR)) {
    console.error('[prerender] dist/ not found — run `vite build` first.');
    process.exit(1);
  }

  // Skip entirely on opt-out (useful for local iteration where you
  // don't want to spend ~5s on every build).
  if (process.env.PRERENDER === 'false' || process.env.SKIP_PRERENDER === '1') {
    console.log('[prerender] skipped (PRERENDER=false)');
    return;
  }

  const server = await startServer();
  console.log(
    `[prerender] serving dist/ from ${ORIGIN}` +
      (IS_SERVERLESS ? ' (serverless mode: @sparticuz/chromium)' : ''),
  );

  let browser;
  let exitCode = 0;
  // Fail-soft policy: on Vercel (and other serverless containers) the
  // build runner is missing the OS-level shared libs Chromium needs
  // (libnss3, libatk-bridge2.0, libxkbcommon, …) and `apt-get install`
  // isn't available without root. @sparticuz/chromium ships some libs
  // for the Lambda RUNTIME environment but the Vercel BUILD container
  // has different baseline libs, so the launch can still fail with
  // "libnss3.so: cannot open shared object file".
  //
  // When that happens, we'd rather ship the SPA + the static SEO
  // baseline (JSON-LD, hreflang, OG, Twitter, sitemap, robots — all
  // present in dist/index.html from the Vite build) than fail the
  // whole deploy. The proper long-term fix is to run prerender in a
  // GitHub Actions job (full Linux, apt-get available) and then
  // `vercel deploy --prebuilt`. Until that's in place, fail-soft keeps
  // production green.
  //
  // Force fail-hard with PRERENDER_STRICT=1 (use in CI where you DO
  // want the build to fail if prerender breaks).
  const failSoft = IS_SERVERLESS && process.env.PRERENDER_STRICT !== '1';

  try {
    browser = await loadPuppeteerAndLaunch();

    for (const route of PRERENDER_ROUTES) {
      const html = await renderRoute(browser, route);
      writeRouteHtml(route, html);
    }

    console.log(`[prerender] ✓ ${PRERENDER_ROUTES.length} routes prerendered`);
  } catch (err) {
    if (failSoft) {
      console.warn('\n[prerender] ⚠  serverless prerender failed — continuing with SPA-only build.');
      console.warn('[prerender]    Reason:', err && err.message ? err.message : err);
      console.warn('[prerender]    The static dist/index.html still ships full SEO');
      console.warn('[prerender]    metadata (title, description, JSON-LD, hreflang,');
      console.warn('[prerender]    OG, Twitter, sitemap). Routes will SPA-render.');
      console.warn('[prerender]    To require prerender to succeed, set PRERENDER_STRICT=1.\n');
      exitCode = 0;
    } else {
      console.error('[prerender] failed:', err);
      exitCode = 1;
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.close();
  }

  process.exit(exitCode);
}

// Wire SIGTERM/SIGINT to a clean shutdown so a CI cancel doesn't
// leave a Chromium process behind.
['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, () => {
    console.log(`\n[prerender] received ${sig}, exiting.`);
    process.exit(130);
  });
});

// Quiet the "unused variable" lint on spawn import — kept for future
// use (e.g. spawning vite preview if we ever drop the in-proc server).
void spawn;

main();
