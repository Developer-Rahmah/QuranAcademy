/**
 * Text Component Styles
 * Tailwind classes for Text, Label, ErrorText, HelpText components
 */
import type { TextVariant } from './Text.types';

export const textStyles = {
  variants: {
    h1: { element: 'h1' as const, styles: 'text-2xl font-medium text-foreground' },
    h2: { element: 'h2' as const, styles: 'text-xl font-medium text-foreground' },
    h3: { element: 'h3' as const, styles: 'text-lg font-medium text-foreground' },
    body: { element: 'p' as const, styles: 'text-base text-foreground' },
    small: { element: 'span' as const, styles: 'text-sm text-foreground' },
    muted: { element: 'span' as const, styles: 'text-sm text-muted' },
  } satisfies Record<TextVariant, { element: 'h1' | 'h2' | 'h3' | 'p' | 'span'; styles: string }>,
} as const;

export const labelStyles = {
  base: 'block text-sm font-medium text-foreground mb-1',
  required: 'text-destructive me-1',
} as const;

export const errorTextStyles = {
  base: 'text-sm text-destructive mt-1 block',
} as const;

export const helpTextStyles = {
  base: 'text-sm text-muted mt-1 block',
} as const;
