/**
 * FormField Component Styles
 * Tailwind classes for FormField and related components
 */

export const formFieldStyles = {
  container: 'w-full',
} as const;

export const formFieldGroupStyles = {
  container: 'grid grid-cols-1 md:grid-cols-2 gap-4',
} as const;

export const formSectionStyles = {
  container: 'space-y-4',
  header: 'flex items-center gap-2 text-primary font-medium',
  icon: 'w-5 h-5',
} as const;
