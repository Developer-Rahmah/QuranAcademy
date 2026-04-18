/**
 * ToggleGroup Component Styles
 * Tailwind classes for ToggleGroup component
 */
import type { ToggleSize } from './ToggleGroup.types';

export const toggleGroupStyles = {
  container: 'flex flex-wrap gap-3',

  button: {
    base: 'rounded-lg border-2 font-medium transition-all flex-1 min-w-0',
    focus: 'focus:outline-none focus:ring-2 focus:ring-primary/20',
    selected: 'border-primary bg-primary/10 text-primary',
    unselected: 'border-border bg-white text-foreground hover:border-primary/40',
    disabled: 'opacity-50 cursor-not-allowed',
  },

  sizes: {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  } satisfies Record<ToggleSize, string>,
} as const;
