/**
 * Checkbox Component Styles
 * Tailwind classes for Checkbox component
 */

export const checkboxStyles = {
  container: {
    base: 'flex items-center gap-3 cursor-pointer',
    disabled: 'opacity-50 cursor-not-allowed',
  },

  wrapper: 'relative',

  input: 'sr-only peer',

  box: {
    base: 'w-5 h-5 border-2 rounded transition-all',
    checked: 'peer-checked:bg-primary peer-checked:border-primary',
    focus: 'peer-focus:ring-2 peer-focus:ring-primary/20',
    error: 'border-destructive',
    normal: 'border-border',
    disabled: 'bg-gray-100',
    enabled: 'bg-white',
  },

  icon: {
    base: 'absolute top-0 left-0 w-5 h-5 text-white p-0.5 pointer-events-none transition-opacity',
    checked: 'opacity-100',
    unchecked: 'opacity-0',
  },

  label: 'text-sm text-foreground',
} as const;
