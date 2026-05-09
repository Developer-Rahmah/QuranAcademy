/**
 * Header Component Styles
 * Tailwind classes for Header component.
 *
 * Mobile-first goals:
 *  - the wrapper never overflows the viewport (overflow-hidden + min-w-0).
 *  - the user block is the only flexible region; long names truncate
 *    instead of wrapping under or escaping the header.
 *  - the action cluster on the opposite side keeps a stable size across
 *    AR / EN, so toggling languages doesn't reflow the header.
 *  - the logout button collapses its text label below `sm`, leaving the
 *    icon visible. The accessible label remains via `aria-label`.
 */

export const headerStyles = {
  header: 'bg-white border-b border-border',
  // overflow-hidden on the outer container guards against any odd
  // child overflow (e.g. an exceptionally long display name on a
  // very narrow screen) shifting horizontal scroll into the header.
  container: 'max-w-7xl mx-auto px-3 sm:px-6 lg:px-8',
  // gap between the three cells (user / logo / actions) is tighter on
  // mobile so a long name can keep more room before it truncates.
  wrapper: 'flex items-center justify-between gap-3 sm:gap-4 h-14 sm:h-16 min-w-0',

  userInfo: {
    // `min-w-0 flex-1` lets the user block shrink to fit; without it
    // truncate is a no-op because flex items default to content-width.
    wrapper: 'flex items-center gap-2 sm:gap-3 min-w-0 flex-1',
    iconWrapper: 'shrink-0 p-1.5 sm:p-2 bg-secondary rounded-lg',
    icon: 'w-5 h-5 sm:w-6 sm:h-6 text-primary',
    textBlock: 'min-w-0 flex-1 leading-tight',
    role: 'text-xs sm:text-sm text-muted truncate',
    name: 'text-sm sm:text-base font-medium text-foreground truncate',
  },

  // Hidden on the smallest viewports so the user block has enough
  // room. Reappears at `sm` (≥640px) where there's headroom.
  logo: {
    wrapper: 'hidden sm:flex items-center gap-2 shrink-0',
    iconWrapper: 'p-2 bg-primary rounded-lg',
    icon: 'w-5 h-5 text-white',
  },

  // Right-side cluster (LanguageSwitcher + feedback + logout). All
  // children get a fixed-shape sizing in `headerActionButton` below
  // so AR/EN parity is preserved.
  actions: 'flex items-center gap-1.5 sm:gap-2 shrink-0',
  // Override per-button so the feedback / logout buttons render as
  // square icon-buttons on mobile and label-pills on `sm`+. Keeps the
  // overall right-side width stable when the user toggles language.
  iconButton:
    'shrink-0 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm leading-none whitespace-nowrap min-h-[36px] sm:min-h-[40px] inline-flex items-center justify-center gap-1 sm:gap-2',
  // Hide the label text below `sm` — icon alone is enough; full label
  // returns at `sm:` for clarity.
  labelInline: 'hidden sm:inline',

  logoutIcon: 'w-4 h-4 shrink-0',
} as const;
