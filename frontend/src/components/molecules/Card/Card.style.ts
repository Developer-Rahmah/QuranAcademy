/**
 * Card Component Styles
 * Tailwind classes for Card and related components
 */
import type { CardVariant, CardPadding } from './Card.types';

export const cardStyles = {
  base: 'rounded-xl',

  variants: {
    default: 'bg-card border border-border/50',
    bordered: 'bg-card border-2 border-primary/20',
    elevated: 'bg-card shadow-lg',
  } satisfies Record<CardVariant, string>,

  padding: {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  } satisfies Record<CardPadding, string>,

  interactive: 'cursor-pointer hover:border-primary/40 transition-colors',

  header: 'mb-4',

  title: 'text-lg font-medium text-foreground',

  description: 'text-sm text-muted mt-1',

  content: '',

  footer: 'mt-4 pt-4 border-t border-border/50',
} as const;
