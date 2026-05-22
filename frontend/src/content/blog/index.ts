/**
 * Blog registry — single source of truth for "what articles exist".
 *
 * Import each article module, list it once in ARTICLES, and the
 * helpers below take care of slug lookup, category filtering, and
 * sorting by date.
 *
 * Adding a new article = create `<slug>.ts`, import it here, push it
 * into ARTICLES, AND add the slug to `src/content/blog/manifest.json`
 * so the prerender + sitemap build scripts pick it up too.
 */
import type { BlogArticle, BlogCategory, BlogListItem } from './types';

import { article as kayfaTabda } from './kayfa-tabda-hifz-al-quran';
import { article as tahfeezAtfal } from './tahfeez-quran-lil-atfal';
import { article as jadwalSanah } from './jadwal-hifz-al-quran-fi-sanah';
import { article as farqTajweedHifz } from './al-farq-bayn-al-tajweed-wa-al-hifz';
import { article as afdalWaqt } from './afdal-waqt-li-hifz-al-quran';
import { article as lilMashghoolin } from './hifz-al-quran-lil-mashghoolin';
import { article as onlineLilAtfal } from './tahfeez-al-quran-online-lil-atfal';
import { article as turuqMurajaa } from './turuq-muraja-at-al-quran';
import { article as ahamiyyatHifz } from './ahamiyyat-hifz-al-quran';
import { article as tathbeetHifz } from './nasaih-li-tathbeet-al-hifz';

export const ARTICLES: ReadonlyArray<BlogArticle> = [
  kayfaTabda,
  tahfeezAtfal,
  jadwalSanah,
  farqTajweedHifz,
  afdalWaqt,
  lilMashghoolin,
  onlineLilAtfal,
  turuqMurajaa,
  ahamiyyatHifz,
  tathbeetHifz,
];

/** Find one article by slug; undefined if no match. */
export function getArticleBySlug(slug: string): BlogArticle | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

/**
 * Listing rows sorted newest-first. Strips the heavy `sections`
 * payload so the listing screen ships a smaller chunk.
 */
export function listArticles(category?: BlogCategory): BlogListItem[] {
  const filtered = category
    ? ARTICLES.filter((a) => a.categories.includes(category))
    : [...ARTICLES];
  return filtered
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .map(({ sections: _sections, faq: _faq, ...rest }) => rest);
}

/**
 * Featured article: the one flagged `featured: true`, or the
 * newest article as a fallback so /blog always renders SOMETHING.
 */
export function getFeaturedArticle(): BlogListItem {
  const explicit = ARTICLES.find((a) => a.featured);
  const pick = explicit ?? ARTICLES[0];
  const { sections: _sections, faq: _faq, ...rest } = pick;
  return rest;
}

/** Every slug, in the order they appear in ARTICLES. Used by build scripts. */
export function allSlugs(): string[] {
  return ARTICLES.map((a) => a.slug);
}

export type { BlogArticle, BlogCategory, BlogListItem, BlogSection, BlogFaqEntry } from './types';
