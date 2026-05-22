#!/usr/bin/env node
/**
 * generate-sitemap — emits `public/sitemap.xml` from the canonical
 * list of public routes + every blog post slug.
 *
 * Runs as `prebuild` so the deployed bundle always ships a fresh
 * sitemap. The file is also checked in so IDEs see a consistent state
 * without running the build.
 *
 * Static routes mirror `src/lib/routes.ts`; blog slugs come from
 * `src/content/blog/manifest.json` (kept in lockstep with the TS
 * registry by the developer when adding articles).
 *
 * Each URL ships its own `xhtml:link` alternates for `ar`, `en` and
 * `x-default` — the site serves the same content in both languages on
 * the same URL (language is a runtime preference).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITE_URL = (
  process.env.VITE_SITE_URL ?? 'https://www.wahdaynakacademy.com'
).replace(/\/+$/, '');

// Static, hand-curated public routes.
const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/register/student', changefreq: 'monthly', priority: '0.7' },
  { path: '/register/teacher', changefreq: 'monthly', priority: '0.7' },
  { path: '/blog', changefreq: 'weekly', priority: '0.8' },
];

// Blog posts — read from the JSON manifest the runtime registry mirrors.
const manifestPath = resolve(__dirname, '..', 'src', 'content', 'blog', 'manifest.json');
let blogRoutes = [];
try {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  blogRoutes = (manifest.slugs ?? []).map((slug) => ({
    path: `/blog/${slug}`,
    changefreq: 'monthly',
    priority: '0.6',
  }));
} catch (err) {
  console.warn(`[sitemap] could not read ${manifestPath} — emitting sitemap without blog posts.`);
  console.warn(`[sitemap] reason: ${err.message}`);
}

const ROUTES = [...STATIC_ROUTES, ...blogRoutes];

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
  const safeLoc = escapeXml(loc);
  return [
    '  <url>',
    `    <loc>${safeLoc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    `    <xhtml:link rel="alternate" hreflang="ar" href="${safeLoc}" />`,
    `    <xhtml:link rel="alternate" hreflang="en" href="${safeLoc}" />`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${safeLoc}" />`,
    '  </url>',
  ].join('\n');
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;

const outPath = resolve(__dirname, '..', 'public', 'sitemap.xml');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, xml, 'utf8');

console.log(
  `✓ sitemap.xml written (${ROUTES.length} URLs: ${STATIC_ROUTES.length} static + ${blogRoutes.length} blog) → ${outPath}`,
);
