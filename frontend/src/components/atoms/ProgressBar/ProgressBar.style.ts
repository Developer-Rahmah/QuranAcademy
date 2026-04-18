/**
 * ProgressBar Component Styles
 * Tailwind classes for ProgressBar and CircularProgress components
 */
import type { ProgressBarSize } from './ProgressBar.types';

export const progressBarStyles = {
  container: 'w-full',

  label: {
    wrapper: 'flex justify-between items-center mb-1',
    text: 'text-sm text-muted',
    value: 'text-sm font-medium text-foreground',
  },

  track: {
    base: 'w-full bg-secondary rounded-full overflow-hidden',
    sizes: {
      sm: 'h-1.5',
      md: 'h-2.5',
      lg: 'h-4',
    } satisfies Record<ProgressBarSize, string>,
  },

  fill: {
    base: 'h-full rounded-full transition-all duration-500 ease-out',
    colors: {
      high: 'bg-success',
      medium: 'bg-primary',
      low: 'bg-gold',
      default: 'bg-primary',
    },
  },
} as const;

export const circularProgressStyles = {
  container: 'relative inline-flex items-center justify-center',
  svg: 'transform -rotate-90',

  track: 'text-secondary',
  fill: 'text-primary transition-all duration-500 ease-out',

  label: {
    wrapper: 'absolute inset-0 flex flex-col items-center justify-center',
    value: 'text-2xl font-bold text-foreground',
  },
} as const;

/**
 * Get progress color based on value
 */
export function getProgressColor(value: number): string {
  if (value >= 75) return progressBarStyles.fill.colors.high;
  if (value >= 50) return progressBarStyles.fill.colors.medium;
  if (value >= 25) return progressBarStyles.fill.colors.low;
  return progressBarStyles.fill.colors.default;
}
