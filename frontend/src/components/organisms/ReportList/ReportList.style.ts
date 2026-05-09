/**
 * ReportList Component Styles
 * Tailwind classes for ReportList, ReportCard, ReportSummary
 */

export const reportListStyles = {
  loading: {
    wrapper: 'flex items-center justify-center py-8',
    spinner: 'animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full',
  },
  empty: 'text-center text-muted py-8',
  list: 'space-y-4',
} as const;

export const reportCardStyles = {
  header: {
    // flex-wrap so date + badges + actions never overflow on narrow screens.
    wrapper: 'flex flex-wrap items-center gap-y-2 gap-x-3 justify-between mb-4',
    date: 'flex items-center gap-2 text-muted',
    dateIcon: 'w-4 h-4',
    dateText: 'text-sm',
    badges: 'flex flex-wrap gap-2',
  },
  items: 'space-y-2',
  item: 'text-sm text-foreground',
  actions: {
    wrapper: 'flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border',
    button:
      'inline-flex items-center gap-1.5 text-sm rounded-md px-2.5 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1',
    edit: 'text-primary hover:bg-primary/10 focus:ring-primary',
    delete: 'text-destructive hover:bg-destructive/10 focus:ring-destructive',
    icon: 'w-4 h-4',
  },
} as const;

export const reportSummaryStyles = {
  container: 'mb-6',
  grid: 'grid grid-cols-2 gap-4 text-center',
  stat: {
    label: 'text-sm text-muted mb-1',
    value: 'text-2xl font-bold',
    valuePrimary: 'text-primary',
    valueForeground: 'text-foreground',
    unit: 'text-xs text-muted',
  },
} as const;
