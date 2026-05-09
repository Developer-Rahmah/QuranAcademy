#!/usr/bin/env node
/**
 * generate-sitemap — emits `public/sitemap.xml` from the canonical
 * list of public routes. Runs as `prebuild` so the deployed bundle
 * always ships a fresh sitemap; the file is also checked in so
 * editors/IDEs see a consistent state without running the build.
 *
 * The route list is mirrored from `src/lib/routes.ts`. We deliberately
 * inline the routes here rather than import from src/ — this is a
 * Node script that runs OUTSIDE the Vite/TS toolchain, and pulling
 * the TS module would require ts-node or a build step. The list is
 * tiny (handful of public surfaces) and changes rarely; a unit test
 * could later assert the two stay in sync if drift becomes a concern.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITE_URL = (
  process.env.VITE_SITE_URL ?? 'https://www.wahdaynakacademy.com'
).replace(/\/+$/, '');

/**
 * Public, indexable routes only. Auth-form pages and authenticated
 * areas are intentionally excluded — they're noindex'd at the meta
 * level too, so listing them in the sitemap would just be noise.
 */
const ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/register/student', changefreq: 'monthly', priority: '0.7' },
  { path: '/register/teacher', changefreq: 'monthly', priority: '0.7' },
];

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const lastmod = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

const urls = ROUTES.map(({ path, changefreq, priority }) => {
  const loc = `${SITE_URL}${path === '/' ? '/' : path}`;
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

const outPath = resolve(__dirname, '..', 'public', 'sitemap.xml');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, xml, 'utf8');

console.log(`✓ sitemap.xml written (${ROUTES.length} URLs) → ${outPath}`);
