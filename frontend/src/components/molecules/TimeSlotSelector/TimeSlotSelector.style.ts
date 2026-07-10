/**
 * TimeSlotSelector Component Styles
 * Tailwind classes for TimeSlotSelector and TimeSlotDisplay
 */

export const timeSlotSelectorStyles = {
  grid: 'grid grid-cols-1 sm:grid-cols-2 gap-3',

  slot: {
    base: 'flex flex-col items-center gap-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all',
    focus: 'focus:outline-none focus:ring-2 focus:ring-primary/20',
    selected: 'border-primary bg-primary/5 text-primary',
    unselected: 'border-border bg-white text-foreground hover:border-primary/40',
    disabled: 'opacity-50 cursor-not-allowed',
    /**
     * Distinct visual for "temporarily complete" slots — muted
     * background + hatched border + warning text so the disabled
     * reason is obvious at a glance. `cursor-not-allowed` mirrors
     * the generic disabled style. The inline "Temporarily complete"
     * pill is rendered via the shared warning-variant Badge so its
     * background is solid enough to read against the muted button.
     */
    completed:
      'border-warning/50 bg-warning/5 text-warning cursor-not-allowed',
  },

  error: 'text-sm text-destructive mt-2',
} as const;

export const timeSlotDisplayStyles = {
  container: 'flex flex-wrap gap-2',
  empty: 'text-muted',
  badge: 'px-2 py-1 text-xs bg-secondary rounded-full text-foreground',
} as const;
