/**
 * usePagination — local-data pager with safe edge handling.
 *
 * Accepts a list and returns the current page's slice plus the controls
 * needed to render a pager. Pure client-side — meant for lists already
 * loaded in memory (the dataset sizes the admin views are well under
 * what would need server-side pagination).
 *
 * Behaviour:
 *   - Defaults to 8 per page (matches the "any list > 8" UX rule).
 *   - When `items` shrinks below the current page's lower bound (e.g.
 *     the user typed into a search box and the filtered list is short),
 *     the page resets to 0 so the rendered slice is always valid.
 *   - When `items` is empty the hook still returns a coherent state
 *     (pageCount: 0, pageItems: [], page: 0).
 */
import { useEffect, useMemo, useState } from 'react';

export const DEFAULT_PAGE_SIZE = 8;

export interface PaginationState<T> {
  /** 0-based current page index. */
  page: number;
  /** Setter — clamped to [0, pageCount-1] when called. */
  setPage: (page: number) => void;
  /** Items belonging to the current page (may be empty). */
  pageItems: T[];
  /** Total number of pages. 0 when items is empty. */
  pageCount: number;
  /** Effective page size used. */
  pageSize: number;
}

export function usePagination<T>(
  items: readonly T[],
  pageSize: number = DEFAULT_PAGE_SIZE,
): PaginationState<T> {
  const [page, setPageRaw] = useState(0);
  const pageCount = Math.ceil(items.length / pageSize);

  // Reset to first page when the dataset shrinks past the current
  // page. Most common trigger: the user typed into a search box so
  // the filtered list is now shorter than `page * pageSize`.
  useEffect(() => {
    if (pageCount === 0) {
      if (page !== 0) setPageRaw(0);
      return;
    }
    if (page >= pageCount) setPageRaw(pageCount - 1);
  }, [pageCount, page]);

  const pageItems = useMemo(() => {
    if (pageCount === 0) return [];
    const safePage = Math.min(Math.max(page, 0), pageCount - 1);
    const start = safePage * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize, pageCount]);

  const setPage = (next: number) => {
    if (pageCount === 0) {
      setPageRaw(0);
      return;
    }
    setPageRaw(Math.min(Math.max(next, 0), pageCount - 1));
  };

  return { page, setPage, pageItems, pageCount, pageSize };
}
