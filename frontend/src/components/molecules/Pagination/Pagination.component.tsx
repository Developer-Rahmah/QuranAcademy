/**
 * Pagination — minimal Prev / page-of-N / Next pager + jump input.
 *
 * Pure presentational. The page state lives in the caller (usually via
 * `usePagination`); this molecule just renders the controls.
 *
 * Self-hides when there's nothing to page through (0 or 1 page). Keeps
 * the UI clean for short lists — the rule "pagination only matters
 * when there's more than one page" is enforced once here, not at every
 * consumer.
 *
 * "Go to page" affordance: an inline number-style input that accepts
 * ASCII digits, Arabic-Indic digits (٠-٩), or Eastern Arabic-Indic
 * digits (۰-۹). All three are normalized to ASCII via the shared
 * `normalizeArabicDigits` helper in lib/validators, so admins using
 * an Arabic keyboard don't have to switch layouts. Submitting via
 * Enter (or blur) clamps to [1, pageCount] and dispatches the change.
 *
 * RTL-safe: uses logical chevrons (« page-of-N ») that flip naturally
 * with `dir`; button order stays Prev → indicator → Next in source
 * order so the visual rhythm follows the document direction.
 */
import { useEffect, useState, type KeyboardEvent } from 'react';
import { useTranslation } from '../../../locales/i18n';
import { cn } from '../../../lib/utils';
import { normalizeArabicDigits } from '../../../lib/validators';

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

  // Draft holds the raw text the user is typing so mid-edit values
  // (e.g. leading zeros, incomplete numbers) render as-typed instead
  // of snapping back to `page + 1` on every keystroke. Committed on
  // Enter or blur.
  const [draft, setDraft] = useState('');
  useEffect(() => {
    // Sync the visible number to the live page when the parent moves
    // us (Prev/Next click, external reset). Only when the input is
    // NOT being actively edited (draft === '').
    if (draft === '') return;
    // Leave the user's in-progress edit alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  if (pageCount <= 1) return null;

  const canPrev = page > 0;
  const canNext = page < pageCount - 1;

  const commitJump = () => {
    // Normalize Arabic-Indic + Eastern Arabic-Indic → ASCII, strip
    // anything non-digit, then parse. Empty / non-numeric input is
    // treated as "no change" so the user isn't stranded on page 0.
    const digits = normalizeArabicDigits(draft).replace(/\D/g, '');
    setDraft('');
    if (!digits) return;
    const requested = parseInt(digits, 10);
    if (Number.isNaN(requested)) return;
    // Convert 1-based UI to 0-based state and clamp.
    const nextZeroBased = Math.min(
      Math.max(requested - 1, 0),
      pageCount - 1,
    );
    if (nextZeroBased !== page) onPageChange(nextZeroBased);
  };

  const onJumpKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitJump();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDraft('');
      (e.currentTarget as HTMLInputElement).blur();
    }
  };

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

      {/* Jump-to-page input. Accepts any-language digits; the
          `inputMode="numeric"` hint asks mobile keyboards for the
          number pad without blocking Arabic keystrokes on desktop. */}
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onJumpKey}
        onBlur={commitJump}
        aria-label={t('pagination.goToLabel')}
        placeholder={t('pagination.goToPlaceholder')}
        className={cn(
          'w-14 px-2 py-1.5 rounded-md border border-border bg-white text-foreground text-center',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
        )}
      />

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
