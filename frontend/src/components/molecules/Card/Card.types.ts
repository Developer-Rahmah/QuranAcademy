/**
 * Card Component Types
 */
import { ReactNode, HTMLAttributes } from 'react';

export type CardVariant = 'default' | 'bordered' | 'elevated';
export type CardPadding = 'sm' | 'md' | 'lg' | 'none';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  children: ReactNode;
}

export interface CardChildProps {
  children: ReactNode;
  className?: string;
}
