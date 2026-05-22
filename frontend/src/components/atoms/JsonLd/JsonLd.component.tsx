/**
 * JsonLd — injects a `<script type="application/ld+json">` into
 * <head> for the duration the component is mounted.
 *
 * Why a managed component instead of inline JSX:
 *   - JSON-LD lives in <head>, not in <body>; React doesn't render
 *     children into <head> natively (no Next-style metadata API in
 *     this Vite SPA).
 *   - Cleanly removed on unmount so route changes never leave stale
 *     schema lingering in the DOM (Google penalises conflicting
 *     schema on the same URL).
 *
 * Each instance is keyed by an `id` data attribute so multiple
 * <JsonLd> components can coexist on a page (Article + FAQPage +
 * BreadcrumbList) without colliding.
 */
import { useEffect } from 'react';

interface JsonLdProps {
  /** Unique identifier — used as `data-jsonld-id` so we can target ours. */
  id: string;
  /** Schema.org JSON-LD object (no need to stringify). */
  data: Record<string, unknown> | Record<string, unknown>[];
}

export function JsonLd({ id, data }: JsonLdProps) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const selector = `script[type="application/ld+json"][data-jsonld-id="${id}"]`;
    let el = document.head.querySelector<HTMLScriptElement>(selector);
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.setAttribute('data-jsonld-id', id);
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);

    return () => {
      // Remove on unmount so navigation to a route without this
      // schema doesn't leave it advertised. The static /
      // EducationalOrganization block in index.html is never managed
      // by this component, so it stays put.
      const onUnmount = document.head.querySelector<HTMLScriptElement>(selector);
      if (onUnmount) onUnmount.remove();
    };
  }, [id, data]);

  return null;
}

export default JsonLd;
