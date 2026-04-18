/**
 * Icon Component Styles
 * Tailwind classes for Icon components
 */
import type { IconSize } from './Icon.types';

export const iconStyles = {
  sizes: {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  } satisfies Record<IconSize, string>,
} as const;
