/**
 * Canonical — single global owner of the `<link rel="canonical">` tag.
 *
 * Mounted ONCE inside `<BrowserRouter>` so `useLocation()` keeps it in
 * sync with the current route. On every navigation it rewrites (or
 * creates) the `<link rel="canonical">` element in `document.head` to
 * reference the current path on the production domain.
 *
 * Why a single component instead of per-page tags:
 *
 *   - This is a Vite-bundled React SPA — there is no Next-style
 *     metadata API, no per-route file. Centralizing keeps the rule
 *     ("canonicals always reflect the current URL on the production
 *     host") in one place that's trivially auditable.
 *   - Search-engine crawlers running JS (Googlebot) pick up the
 *     dynamically updated tag; for crawlers that DON'T run JS, the
 *     pre-rendered default in `index.html` still gives a sensible
 *     homepage canonical.
 *
 * Path normalization rules (matches the conventional SEO baseline):
 *
 *   - Always uses the production host from `SITE_URL`, regardless of
 *     where the SPA happens to be served from (preview deploys, dev,
 *     localhost).
 *   - Drops query strings and hash fragments — canonicals point to the
 *     content URL, not a particular paginated/filtered view.
 *   - Strips trailing slashes EXCEPT on the root path, which keeps
 *     `/` and removes `/about/` → `/about`.
 *
 * Renders nothing — pure side-effect on `document.head`.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE_URL } from '../../../lib/constants';

/** Build the absolute canonical URL for a given client path. */
export function buildCanonicalUrl(pathname: string): string {
  // Defensive: if the router ever hands us an empty string, fall back
  // to the homepage so we never emit a malformed `https://host` URL.
  if (!pathname || pathname === '/') return `${SITE_URL}/`;
  // Collapse repeated slashes, then strip a single trailing slash so
  // `/about` and `/about/` produce the same canonical.
  const normalized = pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return `${SITE_URL}${normalized}`;
}

export function Canonical() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const href = buildCanonicalUrl(pathname);

    // Reuse the static `<link rel="canonical">` baked into index.html
    // when present — keeps a single element across route changes
    // instead of churning the DOM. Create one only on the first run
    // if the static fallback was removed.
    let link = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }

    if (link.getAttribute('href') !== href) {
      link.setAttribute('href', href);
    }
  }, [pathname]);

  return null;
}

export default Canonical;
