/**
 * Input Component Styles
 * Tailwind classes for Input and Textarea components
 */

export const inputStyles = {
  base: 'w-full px-4 py-3 bg-white border rounded-lg text-foreground placeholder:text-muted transition-colors',
  focus: 'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
  disabled: 'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
  error: 'border-destructive focus:ring-destructive/20 focus:border-destructive',
  normal: 'border-border',
} as const;

export const textareaStyles = {
  base: 'w-full px-4 py-3 bg-white border rounded-lg text-foreground placeholder:text-muted transition-colors resize-none',
  focus: 'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
  disabled: 'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50',
  error: 'border-destructive focus:ring-destructive/20 focus:border-destructive',
  normal: 'border-border',
} as const;
