/**
 * ReportForm Component Styles
 * Tailwind classes for ReportForm component
 */

export const reportFormStyles = {
  form: 'space-y-6',
  error: 'p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm',

  dateSection: 'p-6',
  dateLabel: 'block text-sm font-medium text-foreground mb-1',

  noHalaqah: 'p-6 text-center text-sm text-muted space-y-4',

  section: {
    content: 'p-6',
    header: 'flex items-center justify-between mb-4',
    titleWrapper: 'flex items-center gap-2',
    titleIcon: 'w-5 h-5 text-primary',
    title: 'font-medium text-foreground',
    items: 'space-y-4',
    empty: 'text-center text-muted py-4',
  },

  item: {
    wrapper: 'border border-border rounded-lg p-4',
    grid: 'grid grid-cols-1 md:grid-cols-2 gap-4',
    label: 'block text-sm font-medium text-foreground mb-1',
    error: 'text-sm text-destructive mt-1',
    help: 'text-xs text-muted mt-1',
    remove: 'mt-3 text-sm text-destructive hover:underline',
  },

  note: {
    wrapper: 'text-sm text-muted',
    icon: 'text-gold',
  },

  actions: {
    wrapper: 'flex gap-4',
    submit: 'flex-1',
  },

  loading: {
    wrapper: 'flex items-center justify-center py-12',
    spinner: 'animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full',
  },
} as const;
