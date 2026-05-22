/**
 * BlogPost — /blog/:slug article page.
 *
 * Reads the article from the registry by `:slug`, renders structured
 * sections, surfaces an FAQ block, attaches Article + FAQPage +
 * BreadcrumbList JSON-LD, and intercepts internal `<a>` clicks so
 * cross-route navigation stays SPA-fast.
 *
 * SEO: title / description / canonical / OG / hreflang are owned by
 * the global <Seo /> atom, which checks for `/blog/<slug>` and pulls
 * metadata from the same article record we read here. The JSON-LD on
 * this page complements (does not duplicate) the static
 * EducationalOrganization schema in index.html.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Logo } from '../components/atoms/Logo';
import { LanguageSwitcher } from '../components/atoms/LanguageSwitcher';
import { JsonLd } from '../components/atoms/JsonLd';
import { useTranslation } from '../locales/i18n';
import { useSettings } from '../context/SettingsContext';
import { ROUTES, blogPostPath } from '../lib/routes';
import { SITE_URL } from '../lib/constants';
import {
  getArticleBySlug,
  listArticles,
  type BlogArticle,
  type BlogSection,
} from '../content/blog';

// ---------------------------------------------------------------------
// Section renderer
// ---------------------------------------------------------------------
function renderSection(section: BlogSection, idx: number) {
  switch (section.type) {
    case 'p':
      return (
        <p
          key={idx}
          className="text-base sm:text-lg leading-loose text-foreground/90 mb-5"
          // Authored, in-bundle HTML — never user input. Allows inline
          // <a> / <strong> / <em> / <code> inside paragraphs.
          dangerouslySetInnerHTML={{ __html: section.html }}
        />
      );
    case 'h2':
      return (
        <h2
          key={idx}
          id={section.id}
          className="text-2xl sm:text-3xl font-semibold text-foreground mt-10 mb-4 scroll-mt-20"
        >
          {section.text}
        </h2>
      );
    case 'h3':
      return (
        <h3
          key={idx}
          id={section.id}
          className="text-xl font-semibold text-foreground mt-6 mb-3 scroll-mt-20"
        >
          {section.text}
        </h3>
      );
    case 'ul':
      return (
        <ul key={idx} className="list-disc ps-6 mb-5 space-y-2 text-foreground/90 leading-relaxed">
          {section.items.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={idx} className="list-decimal ps-6 mb-5 space-y-2 text-foreground/90 leading-relaxed">
          {section.items.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </ol>
      );
    case 'quote':
      return (
        <blockquote
          key={idx}
          className="border-s-4 border-primary ps-4 my-6 italic text-foreground/80"
        >
          <p dangerouslySetInnerHTML={{ __html: section.html }} />
          {section.cite && (
            <cite className="block mt-2 text-sm text-muted not-italic">{section.cite}</cite>
          )}
        </blockquote>
      );
    case 'callout':
      return (
        <div
          key={idx}
          className={`my-6 rounded-2xl border p-5 ${
            section.tone === 'success'
              ? 'border-primary/40 bg-primary/5'
              : 'border-border bg-secondary/40'
          }`}
        >
          <div className="text-foreground/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: section.html }} />
        </div>
      );
    case 'cta':
      return (
        <div
          key={idx}
          className="my-8 rounded-2xl bg-primary/5 border border-primary/30 p-6 text-center"
        >
          <p className="text-lg font-semibold text-foreground mb-1">{section.label}</p>
          {section.sublabel && (
            <p className="text-sm text-muted mb-4">{section.sublabel}</p>
          )}
          <Link
            to={section.to}
            className="inline-block px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition font-medium"
          >
            {section.label}
          </Link>
        </div>
      );
  }
}

// ---------------------------------------------------------------------
// JSON-LD builders
// ---------------------------------------------------------------------
function buildArticleSchema(article: BlogArticle, academyName: string) {
  const url = `${SITE_URL}${blogPostPath(article.slug)}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: article.title,
    description: article.description,
    inLanguage: 'ar',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    image: `${SITE_URL}${article.coverImage ?? '/wahdaynakacademylogo.png'}`,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { '@type': 'Person', name: article.author },
    publisher: {
      '@type': 'Organization',
      name: academyName,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/wahdaynakacademylogo.png`,
      },
    },
    articleSection: article.categories,
    keywords: article.keywords,
  };
}

function buildFaqSchema(article: BlogArticle) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${SITE_URL}${blogPostPath(article.slug)}#faq`,
    mainEntity: article.faq.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: { '@type': 'Answer', text: entry.a },
    })),
  };
}

function buildBreadcrumbSchema(article: BlogArticle, t: (k: string) => string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('blog.crumbHome'), item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: t('blog.crumbBlog'), item: `${SITE_URL}/blog` },
      {
        '@type': 'ListItem',
        position: 3,
        name: article.title,
        item: `${SITE_URL}${blogPostPath(article.slug)}`,
      },
    ],
  };
}

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------
export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { academyName } = useSettings();
  const articleRef = useRef<HTMLElement | null>(null);

  const article = slug ? getArticleBySlug(slug) : undefined;

  // Intercept internal <a href="/..."> clicks inside the article body
  // so they navigate via React Router instead of forcing a full page
  // reload — the article is rendered from authored HTML strings so we
  // can't use <Link> directly inside paragraphs.
  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      // Only intercept same-origin, non-modified, left-button clicks.
      if (
        !href.startsWith('/') ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        anchor.target === '_blank'
      ) {
        return;
      }
      e.preventDefault();
      navigate(href);
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [navigate, slug]);

  // Scroll to top whenever slug changes (between-articles navigation).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [slug]);

  const related = useMemo(() => {
    if (!article) return [];
    return listArticles()
      .filter(
        (a) =>
          a.slug !== article.slug &&
          a.categories.some((c) => article.categories.includes(c)),
      )
      .slice(0, 3);
  }, [article]);

  if (!slug) return <Navigate to={ROUTES.blog} replace />;
  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-3">{t('blog.notFoundTitle')}</h1>
          <p className="text-muted mb-6">{t('blog.notFoundBody')}</p>
          <Link
            to={ROUTES.blog}
            className="inline-block px-5 py-2.5 rounded-lg bg-primary text-primary-foreground"
          >
            {t('blog.backToList')}
          </Link>
        </div>
      </div>
    );
  }

  const articleSchema = buildArticleSchema(article, academyName);
  const faqSchema = article.faq.length > 0 ? buildFaqSchema(article) : null;
  const breadcrumbSchema = buildBreadcrumbSchema(article, t);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <JsonLd id={`article-${article.slug}`} data={articleSchema} />
      <JsonLd id={`breadcrumb-${article.slug}`} data={breadcrumbSchema} />
      {faqSchema && <JsonLd id={`faq-${article.slug}`} data={faqSchema} />}

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border/50">
        <Link to={ROUTES.home} className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="text-base font-semibold text-foreground">{academyName}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link
            to={ROUTES.blog}
            className="px-3 py-2 text-sm text-foreground/80 hover:text-foreground"
          >
            {t('blog.backToList')}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <article
          ref={articleRef as never}
          className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-10"
        >
          {/* Breadcrumbs (visible) */}
          <nav aria-label="breadcrumb" className="mb-6 text-sm text-muted">
            <Link to={ROUTES.home} className="hover:text-foreground">{t('blog.crumbHome')}</Link>
            <span className="mx-2">›</span>
            <Link to={ROUTES.blog} className="hover:text-foreground">{t('blog.crumbBlog')}</Link>
          </nav>

          {/* Categories */}
          <div className="flex flex-wrap gap-2 mb-4">
            {article.categories.map((c) => (
              <span
                key={c}
                className="px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary"
              >
                {t(`blog.tag${c[0].toUpperCase()}${c.slice(1)}`)}
              </span>
            ))}
          </div>

          <h1 className="text-3xl sm:text-4xl font-semibold text-foreground mb-4 leading-snug">
            {article.title}
          </h1>

          <div className="text-sm text-muted mb-8 flex flex-wrap gap-3 items-center">
            <span>{article.author}</span>
            <span aria-hidden>·</span>
            <time dateTime={article.publishedAt}>{article.publishedAt}</time>
            <span aria-hidden>·</span>
            <span>{article.readingMinutes} {t('blog.minutesShort')}</span>
          </div>

          {/* Body sections */}
          <div>{article.sections.map((s, i) => renderSection(s, i))}</div>

          {/* FAQ */}
          {article.faq.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-6">
                {t('blog.faqTitle')}
              </h2>
              <div className="space-y-4">
                {article.faq.map((entry, i) => (
                  <details
                    key={i}
                    className="rounded-2xl border border-border bg-card p-5"
                  >
                    <summary className="cursor-pointer font-medium text-foreground">
                      {entry.q}
                    </summary>
                    <p className="mt-3 text-foreground/85 leading-relaxed">{entry.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Author / academy CTA at end */}
          <div className="mt-12 rounded-2xl bg-primary/5 border border-primary/30 p-6 text-center">
            <p className="text-lg font-semibold text-foreground mb-1">
              {t('blog.endCtaTitle')}
            </p>
            <p className="text-sm text-muted mb-4">{t('blog.endCtaBody')}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to={ROUTES.registerStudent}
                className="px-5 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition font-medium"
              >
                {t('blog.endCtaStudent')}
              </Link>
              <Link
                to={ROUTES.registerTeacher}
                className="px-5 py-3 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition font-medium"
              >
                {t('blog.endCtaTeacher')}
              </Link>
            </div>
          </div>

          {/* Related */}
          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t('blog.relatedTitle')}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      to={blogPostPath(r.slug)}
                      className="block rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow"
                    >
                      <h3 className="text-base font-semibold text-foreground mb-1 leading-snug">
                        {r.title}
                      </h3>
                      <p className="text-xs text-muted line-clamp-2">{r.summary}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </main>

      <footer className="py-6 px-4 text-center border-t border-border/50 text-sm text-muted">
        {academyName} © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default BlogPost;
