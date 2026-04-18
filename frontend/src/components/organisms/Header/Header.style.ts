/**
 * Header Component Styles
 * Tailwind classes for Header component
 */

export const headerStyles = {
  header: 'bg-white border-b border-border',
  container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  wrapper: 'flex items-center justify-between h-16',

  userInfo: {
    wrapper: 'flex items-center gap-3',
    iconWrapper: 'p-2 bg-secondary rounded-lg',
    icon: 'w-6 h-6 text-primary',
    role: 'text-sm text-muted',
    name: 'font-medium text-foreground',
  },

  logo: {
    wrapper: 'hidden sm:flex items-center gap-2',
    iconWrapper: 'p-2 bg-primary rounded-lg',
    icon: 'w-5 h-5 text-white',
  },

  logoutButton: 'gap-2',
  logoutIcon: 'w-4 h-4',
} as const;
