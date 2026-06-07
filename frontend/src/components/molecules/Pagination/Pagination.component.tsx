/**
 * Pagination — minimal Prev / page-of-N / Next pager.
 *
 * Pure presentational. The page state lives in the caller (usually via
 * `usePagination`); this molecule just renders the controls.
 *
 * Self-hides when there's nothing to page through (0 or 1 page). Keeps
 * the UI clean for short lists — the rule "pagination only matters
 * when there's more than one page" is enforced once here, not at every
 * consumer.
 *
 * RTL-safe: uses logical chevrons (« page-of-N ») that flip naturally
 * with `dir`; button order stays Prev → indicator → Next in source
 * order so the visual rhythm follows the document direction.
 */
import { useTranslation } from '../../../locales/i18n';
import { cn } from '../../../lib/utils';

export interface PaginationProps {
  /** 0-based current page. */
  page: number;
  /** Total number of pages. The component returns null when ≤ 1. */
  pageCount: number;
  /** Setter — receives a 0-based target page. */
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
}: PaginationProps) {
  const { t } = useTranslation();

  if (pageCount <= 1) return null;

  const canPrev = page > 0;
  const canNext = page < pageCount - 1;

  return (
    <nav
      aria-label={t('pagination.label')}
      className={cn(
        'flex items-center justify-center gap-2 mt-4 text-sm',
        className,
      )}
    >
      <button
        type="button"
        disabled={!canPrev}
        onClick={() => onPageChange(page - 1)}
        className={cn(
          'inline-flex items-center justify-center px-3 py-1.5 rounded-md border border-border bg-white text-foreground',
          'hover:bg-muted/40 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white',
        )}
      >
        {t('pagination.prev')}
      </button>

      <span className="px-2 text-muted">
        {t('pagination.pageOf')
          .replace('{{page}}', String(page + 1))
          .replace('{{total}}', String(pageCount))}
      </span>

      <button
        type="button"
        disabled={!canNext}
        onClick={() => onPageChange(page + 1)}
        className={cn(
          'inline-flex items-center justify-center px-3 py-1.5 rounded-md border border-border bg-white text-foreground',
          'hover:bg-muted/40 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white',
        )}
      >
        {t('pagination.next')}
      </button>
    </nav>
  );
}

export default Pagination;
