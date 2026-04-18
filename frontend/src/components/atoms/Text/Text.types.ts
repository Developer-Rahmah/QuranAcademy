/**
 * Text Component Types
 */
import { ReactNode, ElementType, HTMLAttributes, LabelHTMLAttributes } from 'react';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'muted';

export interface TextProps extends HTMLAttributes<HTMLElement> {
  variant?: TextVariant;
  as?: ElementType;
  children: ReactNode;
}

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  children: ReactNode;
}

export interface ErrorTextProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
}

export interface HelpTextProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
}
