/**
 * Button Component Styles
 * Tailwind classes for Button component
 */
import type { ButtonVariant, ButtonSize } from './Button.types';

export const buttonStyles = {
  base: 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',

  variants: {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-secondary',
    outline: 'border-2 border-primary text-primary bg-transparent hover:bg-primary/5 focus:ring-primary',
    ghost: 'text-foreground hover:bg-secondary/50 focus:ring-secondary',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
  } satisfies Record<ButtonVariant, string>,

  sizes: {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
    full: 'px-4 py-3 text-base w-full',
  } satisfies Record<ButtonSize, string>,

  spinner: {
    container: 'animate-spin h-5 w-5',
    circle: 'opacity-25',
    path: 'opacity-75',
  },
} as const;
