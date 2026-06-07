/**
 * PaginatedList — render-prop wrapper that paginates an array.
 *
 * Use when the consumer can't call `usePagination` directly (e.g. the
 * list is rendered inside an IIFE during a parent's JSX, where React
 * hook rules disallow a hook call). The wrapper owns the page state
 * and forwards the current page slice to its render-prop child.
 *
 *   <PaginatedList items={rows}>
 *     {(pageItems) => (
 *       <ul>{pageItems.map(...)}</ul>
 *     )}
 *   </PaginatedList>
 *
 * The page state resets to a valid page when `items` shrinks (e.g.
 * after a search filter narrows the dataset) — see the hook docs.
 */
import { usePagination, DEFAULT_PAGE_SIZE } from '../../../hooks/usePagination';
import { Pagination } from './Pagination.component';

export interface PaginatedListProps<T> {
  items: readonly T[];
  pageSize?: number;
  className?: string;
  children: (pageItems: T[]) => React.ReactNode;
}

export function PaginatedList<T>({
  items,
  pageSize = DEFAULT_PAGE_SIZE,
  className,
  children,
}: PaginatedListProps<T>) {
  const { page, setPage, pageItems, pageCount } = usePagination(
    items,
    pageSize,
  );
  return (
    <div className={className}>
      {children(pageItems)}
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  );
}

export default PaginatedList;
