/**
 * StatCard Component Styles
 * Tailwind classes for StatCard and related components
 */
import type { StatCardVariant } from './StatCard.types';

export const statCardStyles = {
  variants: {
    default: 'bg-card',
    primary: 'bg-primary/5',
    success: 'bg-success/5',
  } satisfies Record<StatCardVariant, string>,

  content: {
    wrapper: 'flex items-start justify-between',
    textContent: 'flex-1',
    title: 'text-sm text-muted',
    value: 'text-3xl font-bold text-foreground mt-1',
    subtitle: 'text-xs text-muted mt-1',
  },

  icon: {
    wrapper: 'p-3 bg-secondary/50 rounded-xl',
    icon: 'w-6 h-6 text-primary',
  },

  progress: {
    wrapper: 'mt-4',
    label: 'text-xs text-muted mb-2',
  },

  row: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
} as const;
