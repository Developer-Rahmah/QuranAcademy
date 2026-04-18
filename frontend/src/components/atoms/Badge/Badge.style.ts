/**
 * Badge Component Styles
 * Tailwind classes for Badge and StatusBadge components
 */
import type { BadgeVariant, BadgeSize } from './Badge.types';

export const badgeStyles = {
  base: 'inline-flex items-center justify-center rounded-full font-medium',

  variants: {
    default: 'bg-secondary text-secondary-foreground',
    primary: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    success: 'bg-success text-white',
    warning: 'bg-gold text-white',
    destructive: 'bg-destructive text-destructive-foreground',
    outline: 'border border-border bg-transparent text-foreground',
    muted: 'bg-muted/20 text-muted',
  } satisfies Record<BadgeVariant, string>,

  sizes: {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  } satisfies Record<BadgeSize, string>,

  statusBadge: {
    gap: 'gap-1',
  },

  icon: 'w-3 h-3',
} as const;
