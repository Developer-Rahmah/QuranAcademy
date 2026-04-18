/**
 * MeetLinkCard Component Styles
 * Tailwind classes for MeetLinkCard component
 */

export const meetLinkCardStyles = {
  empty: 'bg-secondary/30',
  emptyText: 'text-sm text-muted text-center',

  header: {
    wrapper: 'flex items-center justify-between mb-2',
    label: 'text-sm text-muted',
    icon: 'w-5 h-5 text-primary',
  },

  linkContainer: 'flex items-center gap-2 p-3 bg-secondary/30 rounded-lg',

  copyButton: {
    base: 'p-2 hover:bg-white/50 rounded-lg transition-colors',
    copyIcon: 'w-4 h-4 text-muted',
    checkIcon: 'w-4 h-4 text-success',
  },

  linkButton: 'flex-1 text-sm text-primary hover:underline text-start truncate',

  openButton: {
    base: 'p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors',
    icon: 'w-4 h-4',
  },
} as const;
