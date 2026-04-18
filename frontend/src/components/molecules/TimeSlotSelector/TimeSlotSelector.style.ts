/**
 * TimeSlotSelector Component Styles
 * Tailwind classes for TimeSlotSelector and TimeSlotDisplay
 */

export const timeSlotSelectorStyles = {
  grid: 'grid grid-cols-1 sm:grid-cols-2 gap-3',

  slot: {
    base: 'px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all',
    focus: 'focus:outline-none focus:ring-2 focus:ring-primary/20',
    selected: 'border-primary bg-primary/5 text-primary',
    unselected: 'border-border bg-white text-foreground hover:border-primary/40',
    disabled: 'opacity-50 cursor-not-allowed',
  },

  error: 'text-sm text-destructive mt-2',
} as const;

export const timeSlotDisplayStyles = {
  container: 'flex flex-wrap gap-2',
  empty: 'text-muted',
  badge: 'px-2 py-1 text-xs bg-secondary rounded-full text-foreground',
} as const;
