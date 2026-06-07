/**
 * BlogList — /blog index page.
 *
 * Layout:
 *   - Top bar with logo + language switcher + back to home
 *   - Featured article hero (flagged via `featured: true`)
 *   - Category filter (Hifz / Tajweed / Kids / Beginners / Review)
 *   - Grid of latest articles
 *
 * SEO: the global <Seo /> atom owns title/canonical/hreflang for this
 * route via the entry in src/lib/seo.ts. We add a Blog-specific
 * `Blog` JSON-LD here so Google understands this is a content hub.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/atoms/Logo';
import { LanguageSwitcher } from '../components/atoms/LanguageSwitcher';
import { JsonLd } from '../components/atoms/JsonLd';
import { Pagination } from '../components/molecules/Pagination';
import { usePagination } from '../hooks/usePagination';
import { useTranslation } from '../locales/i18n';
import { useSettings } from '../context/SettingsContext';
import { ROUTES, blogPostPath } from '../lib/routes';
import { SITE_URL } from '../lib/constants';
import { listArticles, getFeaturedArticle, type BlogCategory } from '../content/blog';

const CATEGORIES: Array<{ key: BlogCategory | 'all'; labelKey: string }> = [
  { key: 'all', labelKey: 'blog.tagAll' },
  { key: 'hifz', labelKey: 'blog.tagHifz' },
  { key: 'tajweed', labelKey: 'blog.tagTajweed' },
  { key: 'kids', labelKey: 'blog.tagKids' },
  { key: 'beginners', labelKey: 'blog.tagBeginners' },
  { key: 'review', labelKey: 'blog.tagReview' },
];

export function BlogList() {
  const { t } = useTranslation();
  const { academyName } = useSettings();
  const [activeCategory, setActiveCategory] = useState<BlogCategory | 'all'>('all');

  const featured = useMemo(() => getFeaturedArticle(), []);
  const articles = useMemo(
    () =>
      listArticles(activeCategory === 'all' ? undefined : activeCategory)
        // Exclude the featured one from the grid so it doesn't appear twice.
        .filter((a) => a.slug !== featured.slug),
    [activeCategory, featured.slug],
  );

  // Page through the filtered grid. Page resets to 0 when the user
  // picks a new category (usePagination clamps automatically).
  const { page, setPage, pageItems, pageCount } = usePagination(articles);

  // Blog hub schema — helps Google identify this as a section index.
  const blogSchema = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      '@id': `${SITE_URL}/blog#blog`,
      url: `${SITE_URL}/blog`,
      name: `${t('blog.title')} — ${academyName}`,
      description: t('blog.description'),
      inLanguage: ['ar', 'en'],
      publisher: { '@id': `${SITE_URL}/#organization` },
      blogPost: listArticles().map((a) => ({
        '@type': 'BlogPosting',
        '@id': `${SITE_URL}${blogPostPath(a.slug)}#article`,
        headline: a.title,
        url: `${SITE_URL}${blogPostPath(a.slug)}`,
        datePublished: a.publishedAt,
        dateModified: a.updatedAt,
        author: { '@type': 'Person', name: a.author },
      })),
    }),
    [t, academyName],
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <JsonLd id="blog-index" data={blogSchema} />

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border/50">
        <Link to={ROUTES.home} className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="text-base font-semibold text-foreground">{academyName}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link
            to={ROUTES.home}
            className="px-3 py-2 text-sm text-foreground/80 hover:text-foreground"
          >
            {t('common.back')}
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-8 py-10 max-w-5xl w-full mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold text-foreground mb-3">
            {t('blog.title')}
          </h1>
          <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            {t('blog.description')}
          </p>
        </div>

        {/* Featured */}
        <Link
          to={blogPostPath(featured.slug)}
          className="block mb-10 rounded-2xl border border-border bg-card p-6 sm:p-8 hover:shadow-lg transition-shadow"
        >
          <div className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-3">
            {t('blog.featured')}
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-3 leading-snug">
            {featured.title}
          </h2>
          <p className="text-base text-muted leading-relaxed mb-4">{featured.summary}</p>
          <div className="text-sm text-muted">
            {featured.author} · {featured.publishedAt} · {featured.readingMinutes}{' '}
            {t('blog.minutesShort')}
          </div>
        </Link>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveCategory(c.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                activeCategory === c.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-foreground border border-border hover:bg-secondary'
              }`}
            >
              {t(c.labelKey)}
            </button>
          ))}
        </div>

        {/* Grid */}
        {articles.length === 0 ? (
          <p className="text-center text-muted py-12">{t('blog.empty')}</p>
        ) : (
          <>
          <ul className="grid gap-6 sm:grid-cols-2">
            {pageItems.map((a) => (
              <li key={a.slug}>
                <Link
                  to={blogPostPath(a.slug)}
                  className="block h-full rounded-2xl border border-border bg-card p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-wrap gap-2 mb-3">
                    {a.categories.map((cat) => (
                      <span
                        key={cat}
                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-secondary text-foreground/80"
                      >
                        {t(`blog.tag${cat[0].toUpperCase()}${cat.slice(1)}`)}
                      </span>
                    ))}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2 leading-snug">
                    {a.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed mb-3 line-clamp-3">
                    {a.summary}
                  </p>
                  <div className="text-xs text-muted">
                    {a.publishedAt} · {a.readingMinutes} {t('blog.minutesShort')}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
          </>
        )}
      </main>

      <footer className="py-6 px-4 text-center border-t border-border/50 text-sm text-muted">
        {academyName} © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default BlogList;
