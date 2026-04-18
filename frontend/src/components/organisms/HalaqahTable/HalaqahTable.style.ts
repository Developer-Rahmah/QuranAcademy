/**
 * HalaqahTable Component Styles
 * Tailwind classes for HalaqahTable component
 */

export const halaqahTableStyles = {
  loading: {
    wrapper: 'flex items-center justify-center py-8',
    spinner: 'animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full',
  },
  empty: 'text-center text-muted py-8',

  container: 'overflow-hidden',
  scrollWrapper: 'overflow-x-auto',
  table: 'w-full',

  thead: '',
  headerRow: 'border-b border-border bg-secondary/30',
  headerCell: 'px-6 py-4 text-right text-sm font-medium text-foreground',

  tbody: '',
  bodyRowEven: 'bg-white',
  bodyRowOdd: 'bg-secondary/10',
  bodyCell: 'px-6 py-4 text-foreground',
  bodyCellBold: 'px-6 py-4 font-medium text-foreground',

  progressCell: {
    wrapper: 'flex items-center gap-3',
    value: 'text-sm font-medium text-foreground whitespace-nowrap',
    bar: 'w-24',
  },
} as const;
