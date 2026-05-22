/**
 * Seo — single global owner of every SEO-relevant `<head>` tag.
 *
 * Mounted ONCE inside `<BrowserRouter>` and `<I18nProvider>`. On every
 * route change (and every language change) it rewrites:
 *
 *   - <title>
 *   - <meta name="description">
 *   - <meta name="keywords">
 *   - <meta name="robots">
 *   - <link rel="canonical">
 *   - <link rel="alternate" hreflang="ar|en|x-default">
 *   - Open Graph tags (og:title, og:description, og:url, og:image,
 *     og:image:width/height/type/alt, og:type, og:site_name, og:locale,
 *     og:locale:alternate)
 *   - Twitter Card tags (twitter:card, twitter:title,
 *     twitter:description, twitter:image, twitter:image:alt)
 *
 * The route → metadata map lives in `lib/seo.ts`; this component is
 * just the renderer. Keeping the routing-table separate means a
 * new page is one config entry, not a re-render of every consumer.
 *
 * Why a DOM-managed atom instead of `react-helmet-async`:
 *   - Zero extra dependencies for a 60-line job.
 *   - Reuses the static fallbacks already in `index.html` (single
 *     element across navigations — no churn, no duplicate tags).
 *   - JS-less crawlers still see the `index.html` defaults; JS
 *     crawlers (Googlebot) execute this and read the live values.
 *
 * Renders nothing — pure side-effect on `document.head`.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../../../locales/i18n';
import { useSettings } from '../../../context/SettingsContext';
import { SITE_URL } from '../../../lib/constants';
import {
  DEFAULT_KEYWORDS_AR,
  DEFAULT_KEYWORDS_EN,
  DEFAULT_OG_IMAGE,
  resolveSeoEntry,
} from '../../../lib/seo';
import { getArticleBySlug } from '../../../content/blog';

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

/**
 * Build the absolute canonical URL for a given client path.
 * Drops query/hash and normalizes trailing slash (root keeps `/`,
 * everything else strips trailing slash).
 */
export function buildCanonicalUrl(pathname: string): string {
  if (!pathname || pathname === '/') return `${SITE_URL}/`;
  const normalized = pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return `${SITE_URL}${normalized}`;
}

/**
 * Build an absolute URL for an OG image path (must start with `/`).
 */
function buildAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${path}`;
}

/**
 * Find or create a `<meta>` tag and set its `content`. Uses
 * (attrName, attrValue) as the lookup key — supports both
 * `name="..."` (standard) and `property="..."` (Open Graph).
 */
function setMeta(
  attrName: 'name' | 'property',
  attrValue: string,
  content: string,
): void {
  const selector = `meta[${attrName}="${attrValue}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  if (el.getAttribute('content') !== content) {
    el.setAttribute('content', content);
  }
}

/**
 * Find or create the `<link rel="canonical">` element and set its
 * href. Reuses the static element from `index.html` when present.
 */
function setCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  if (el.getAttribute('href') !== href) {
    el.setAttribute('href', href);
  }
}

/**
 * Replace the full set of `<link rel="alternate" hreflang="…">` tags
 * with a fresh list for the current canonical URL. Each call clears
 * the previous list and inserts new entries — Google requires every
 * language variant to be advertised on every page in the cluster.
 *
 * The site serves AR and EN at the SAME URLs (language is a runtime
 * preference, not a path segment) so every variant points at the same
 * canonical href. `x-default` is the locale-neutral landing target.
 */
function setHreflangAlternates(canonicalHref: string): void {
  const existing = document.head.querySelectorAll<HTMLLinkElement>(
    'link[rel="alternate"][hreflang]',
  );
  existing.forEach((el) => el.parentNode?.removeChild(el));

  const variants: Array<{ hreflang: string; href: string }> = [
    { hreflang: 'ar', href: canonicalHref },
    { hreflang: 'en', href: canonicalHref },
    { hreflang: 'x-default', href: canonicalHref },
  ];

  for (const v of variants) {
    const link = document.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute('hreflang', v.hreflang);
    link.setAttribute('href', v.href);
    document.head.appendChild(link);
  }
}

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------

export function Seo() {
  const { pathname } = useLocation();
  const { t, language } = useTranslation();
  const { academyName } = useSettings();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const entry = resolveSeoEntry(pathname);

    // Blog-post override: when on `/blog/<slug>`, pull title /
    // description / keywords from the article's own metadata. This
    // avoids registering every slug in SEO_ROUTES and means a new
    // article's SEO Just Works as soon as it's added to the registry.
    const blogMatch = /^\/blog\/([^/?#]+)/.exec(pathname);
    const blogArticle = blogMatch ? getArticleBySlug(blogMatch[1]) : undefined;

    // Resolve copy through i18n. Falls back to a sensible global
    // default if a per-route key is missing — the brand name for
    // title, the global tagline for description.
    const rawTitle = blogArticle
      ? blogArticle.title
      : entry
        ? t(entry.titleKey)
        : t('seo.defaultTitle');
    // i18n's `t()` returns the key itself when missing — guard against
    // that so we never render a literal `seo.foo.title` in the tab bar.
    const resolvedTitle =
      rawTitle && !rawTitle.startsWith('seo.') ? rawTitle : academyName;
    // Brand suffix gives every tab a consistent "<page> — <brand>"
    // shape. Skipped on the homepage where the title IS the brand.
    const fullTitle =
      pathname === '/' ? resolvedTitle : `${resolvedTitle} — ${academyName}`;

    const description = blogArticle
      ? blogArticle.description
      : entry
        ? t(entry.descriptionKey)
        : t('seo.defaultDescription');

    const keywords = blogArticle
      ? blogArticle.keywords
      : entry?.keywordsKey
        ? t(entry.keywordsKey)
        : language === 'ar'
          ? DEFAULT_KEYWORDS_AR
          : DEFAULT_KEYWORDS_EN;

    const robots = entry?.robots ?? 'index, follow';
    const canonicalUrl = buildCanonicalUrl(pathname);
    const ogImage = buildAbsoluteUrl(entry?.ogImagePath ?? DEFAULT_OG_IMAGE);
    const ogLocale = language === 'ar' ? 'ar_SA' : 'en_US';
    const ogLocaleAlternate = language === 'ar' ? 'en_US' : 'ar_SA';
    const htmlLang = language === 'ar' ? 'ar' : 'en';
    const imageAlt =
      language === 'ar'
        ? `${academyName} — شعار الأكاديمية`
        : `${academyName} — academy logo`;

    // ----- title + standard meta -----
    if (document.title !== fullTitle) document.title = fullTitle;
    setMeta('name', 'description', description);
    setMeta('name', 'keywords', keywords);
    setMeta('name', 'robots', robots);
    // Googlebot-specific directive mirrors the generic one so rich-result
    // snippet limits aren't accidentally clipped to the default 160 chars.
    setMeta(
      'name',
      'googlebot',
      `${robots}, max-image-preview:large, max-snippet:-1, max-video-preview:-1`,
    );

    // Keep <html lang> in sync as the user toggles languages — separate
    // effect (DirectionShell) also updates `dir`, but setting `lang` here
    // ensures it's in place for crawlers that snapshot after JS hydration.
    if (document.documentElement.getAttribute('lang') !== htmlLang) {
      document.documentElement.setAttribute('lang', htmlLang);
    }

    // ----- canonical + hreflang -----
    setCanonical(canonicalUrl);
    setHreflangAlternates(canonicalUrl);

    // ----- Open Graph -----
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', ogImage);
    setMeta('property', 'og:image:secure_url', ogImage);
    setMeta('property', 'og:image:type', 'image/png');
    setMeta('property', 'og:image:width', '1200');
    setMeta('property', 'og:image:height', '630');
    setMeta('property', 'og:image:alt', imageAlt);
    // Blog posts emit `og:type=article` + published/modified time so
    // social previews show "Article" treatment and Google understands
    // freshness. Everything else stays `website`.
    setMeta('property', 'og:type', blogArticle ? 'article' : 'website');
    if (blogArticle) {
      setMeta('property', 'article:published_time', blogArticle.publishedAt);
      setMeta('property', 'article:modified_time', blogArticle.updatedAt);
      setMeta('property', 'article:author', blogArticle.author);
      // `article:section` is single-value per spec — we keep the
      // primary category here. Per-tag values could be emitted via
      // `article:tag` as a multi-value pair if needed in future.
      setMeta('property', 'article:section', blogArticle.categories[0] ?? 'hifz');
    }
    setMeta('property', 'og:site_name', academyName);
    setMeta('property', 'og:locale', ogLocale);
    setMeta('property', 'og:locale:alternate', ogLocaleAlternate);

    // ----- Twitter Card -----
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', ogImage);
    setMeta('name', 'twitter:image:alt', imageAlt);
  }, [pathname, language, t, academyName]);

  return null;
}

export default Seo;
