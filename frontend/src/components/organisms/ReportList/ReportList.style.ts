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
    wrapper: 'flex items-center justify-between mb-4',
    date: 'flex items-center gap-2 text-muted',
    dateIcon: 'w-4 h-4',
    dateText: 'text-sm',
    badges: 'flex gap-2',
  },
  items: 'space-y-2',
  item: 'text-sm text-foreground',
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
