/**
 * SEO config — single source of truth for per-route metadata.
 *
 * Each entry maps a route (or a route prefix) to translation keys. The
 * `<Seo />` atom resolves these via `t()` so titles and descriptions
 * follow the user's active language. Avoid hardcoding English/Arabic
 * strings here — the i18n layer is the canonical source.
 *
 * Why translation keys instead of literal strings:
 *   - Keeps SEO copy in the same place as user-visible copy.
 *   - Avoids divergence: a translator updating `landing.subtitle`
 *     automatically updates the meta description for `/`.
 *
 * `match` modes:
 *   - 'exact'  → only fires when `pathname === route` (default).
 *   - 'prefix' → fires when `pathname.startsWith(route)`. Use for
 *                section pages where a single description applies to
 *                the whole subtree (e.g. all /admin pages noindex).
 *
 * Lookup order: routes are scanned top-to-bottom, FIRST match wins.
 * Put the most specific routes first, prefix routes last.
 */
import { ROUTES } from './routes';

export type RobotsDirective =
  | 'index, follow'
  | 'noindex, follow'
  | 'noindex, nofollow';

/** Per-route metadata. All fields except `path` are translation keys. */
export interface SeoEntry {
  path: string;
  match?: 'exact' | 'prefix';
  /** i18n key for `<title>`. Falls back to `seo.defaultTitle` if missing. */
  titleKey: string;
  /** i18n key for `<meta name="description">`. */
  descriptionKey: string;
  /** Optional override of the global keyword set (i18n key, comma-separated). */
  keywordsKey?: string;
  /**
   * Robots directive. Default for public pages is 'index, follow'.
   * Auth pages use 'noindex, follow' so crawlers don't index login
   * forms but still crawl outbound links. Authenticated pages use
   * 'noindex, nofollow' — they shouldn't appear in search at all.
   */
  robots?: RobotsDirective;
  /**
   * Optional OG image override — falls back to `DEFAULT_OG_IMAGE`.
   * Path must be absolute (e.g. /og/landing.png) so the canonical-host
   * resolver can prefix the production domain.
   */
  ogImagePath?: string;
}

/**
 * Default OG image — the academy logo. Lives in /public/ so Vite
 * copies it as-is. Override per-page via `ogImagePath`.
 */
export const DEFAULT_OG_IMAGE = '/wahdaynakacademylogo.png';

/**
 * Default meta keywords. Bilingual on purpose so the same site
 * surfaces in both Arabic and English search queries. Per-page
 * overrides go through `keywordsKey`.
 */
export const DEFAULT_KEYWORDS_AR =
  'أكاديمية قرآن, تحفيظ القرآن الكريم, تعليم القرآن, تجويد, قراءة, إجازة, دورات قرآن, تعلم القرآن أونلاين, حفظ القرآن, مدرس قرآن';

export const DEFAULT_KEYWORDS_EN =
  'Quran academy, online Quran learning, memorize Quran, tajweed, recitation, ijazah, Quran courses, online Quran teacher, Quran classes, learn Quran online';

// ---------------------------------------------------------------------
// Per-route table.
//
// Public pages → 'index, follow'.
// Auth-form pages → 'noindex, follow' (don't index login/forgot, but
//   still let crawlers follow links from them).
// Authenticated areas (/dashboard, /admin, /report, /halaqah) →
//   'noindex, nofollow' via the catch-all prefix entries at the end.
// ---------------------------------------------------------------------
export const SEO_ROUTES: ReadonlyArray<SeoEntry> = [
  // ----- Public -----
  {
    path: ROUTES.home,
    match: 'exact',
    titleKey: 'seo.home.title',
    descriptionKey: 'seo.home.description',
    robots: 'index, follow',
  },
  {
    path: ROUTES.registerStudent,
    match: 'exact',
    titleKey: 'seo.registerStudent.title',
    descriptionKey: 'seo.registerStudent.description',
    robots: 'index, follow',
  },
  {
    path: ROUTES.registerTeacher,
    match: 'exact',
    titleKey: 'seo.registerTeacher.title',
    descriptionKey: 'seo.registerTeacher.description',
    robots: 'index, follow',
  },

  // ----- Auth forms (noindex but follow) -----
  {
    path: ROUTES.login,
    match: 'exact',
    titleKey: 'seo.login.title',
    descriptionKey: 'seo.login.description',
    robots: 'noindex, follow',
  },
  {
    path: ROUTES.signup,
    match: 'exact',
    titleKey: 'seo.signup.title',
    descriptionKey: 'seo.signup.description',
    robots: 'noindex, follow',
  },
  {
    path: ROUTES.forgotPassword,
    match: 'exact',
    titleKey: 'seo.forgotPassword.title',
    descriptionKey: 'seo.forgotPassword.description',
    robots: 'noindex, follow',
  },
  {
    path: ROUTES.resetPassword,
    match: 'exact',
    titleKey: 'seo.resetPassword.title',
    descriptionKey: 'seo.resetPassword.description',
    robots: 'noindex, nofollow',
  },
  {
    path: ROUTES.success,
    match: 'exact',
    titleKey: 'seo.success.title',
    descriptionKey: 'seo.success.description',
    robots: 'noindex, follow',
  },

  // ----- Authenticated areas (catch-all prefixes) -----
  {
    path: '/dashboard',
    match: 'prefix',
    titleKey: 'seo.dashboard.title',
    descriptionKey: 'seo.dashboard.description',
    robots: 'noindex, nofollow',
  },
  {
    path: '/admin',
    match: 'prefix',
    titleKey: 'seo.admin.title',
    descriptionKey: 'seo.admin.description',
    robots: 'noindex, nofollow',
  },
  {
    path: '/halaqah',
    match: 'prefix',
    titleKey: 'seo.halaqah.title',
    descriptionKey: 'seo.halaqah.description',
    robots: 'noindex, nofollow',
  },
  {
    path: '/report',
    match: 'prefix',
    titleKey: 'seo.report.title',
    descriptionKey: 'seo.report.description',
    robots: 'noindex, nofollow',
  },
];

/**
 * Resolve the SEO entry for a given pathname. Tries exact matches
 * first, then prefix matches in order. Returns `null` so the caller
 * can fall back to global defaults (homepage SEO).
 */
export function resolveSeoEntry(pathname: string): SeoEntry | null {
  // Exact match pass — strictly higher priority than prefix.
  for (const entry of SEO_ROUTES) {
    if (entry.match !== 'prefix' && entry.path === pathname) return entry;
  }
  // Prefix match pass.
  for (const entry of SEO_ROUTES) {
    if (entry.match === 'prefix' && pathname.startsWith(entry.path)) {
      return entry;
    }
  }
  return null;
}
