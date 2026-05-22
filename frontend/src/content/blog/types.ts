/**
 * Blog content types.
 *
 * Articles are stored as structured TS modules (one file per slug)
 * rather than markdown so we can keep the build chain dependency-free
 * (no markdown parser) AND give every section a typed shape — making
 * it trivial to extract FAQ entries for FAQPage JSON-LD, render
 * call-to-action cards as React Router <Link>s, etc.
 */

export type BlogCategory =
  | 'hifz'        // Memorization
  | 'tajweed'     // Tajweed / recitation
  | 'kids'        // Child-focused
  | 'beginners'   // Starter content
  | 'review';     // Review / consolidation

/**
 * One block of article body. Paragraphs accept inline HTML (safe —
 * authored, not user input) so authors can drop `<a href="...">` or
 * `<strong>` directly into the text. The runtime renderer escapes
 * nothing extra; trust comes from the fact these strings ship inside
 * the bundle.
 */
export type BlogSection =
  | { type: 'p'; html: string }
  | { type: 'h2'; text: string; id: string }
  | { type: 'h3'; text: string; id?: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; html: string; cite?: string }
  | { type: 'callout'; tone?: 'info' | 'success'; html: string }
  | {
      type: 'cta';
      to: '/register/student' | '/register/teacher' | '/' | string;
      label: string;
      sublabel?: string;
    };

export interface BlogFaqEntry {
  q: string;
  a: string;
}

export interface BlogArticle {
  /** URL-safe slug (Latin transliteration). Used as the route segment. */
  slug: string;
  /** Page <h1> and <title>. */
  title: string;
  /** Meta description + OG description (~150-160 chars). */
  description: string;
  /** Mixed Arabic + English, comma-separated. */
  keywords: string;
  /** ISO date, YYYY-MM-DD. */
  publishedAt: string;
  /** ISO date, YYYY-MM-DD. */
  updatedAt: string;
  /** One or more category tags for filtering. */
  categories: BlogCategory[];
  /** Short tagline shown in the listing card. */
  summary: string;
  /** Approximate reading time in minutes (set manually). */
  readingMinutes: number;
  /**
   * Absolute path (under /public) to the cover image. Falls back to
   * the academy logo if not provided.
   */
  coverImage?: string;
  /** Author display name. */
  author: string;
  /** Pin one article to the top of /blog as the featured card. */
  featured?: boolean;
  /** Body content as ordered sections. */
  sections: BlogSection[];
  /** FAQ entries → rendered as a section AND emitted as FAQPage JSON-LD. */
  faq: BlogFaqEntry[];
}

/** A row in the listing screen — strips the heavy `sections` field. */
export interface BlogListItem
  extends Omit<BlogArticle, 'sections' | 'faq'> {}
