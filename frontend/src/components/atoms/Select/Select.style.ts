/**
 * Select Component Styles
 * Tailwind classes for Select component
 */

export const selectStyles = {
  wrapper: 'relative',

  select: {
    base: 'w-full px-4 py-3 bg-white border rounded-lg text-foreground appearance-none cursor-pointer transition-colors',
    focus: 'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
    disabled: 'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
    error: 'border-destructive focus:ring-destructive/20 focus:border-destructive',
    normal: 'border-border',
    placeholder: 'text-muted',
  },

  icon: {
    wrapper: 'absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none',
    svg: 'w-4 h-4 text-muted',
  },
} as const;
