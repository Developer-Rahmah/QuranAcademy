/**
 * Text Component
 * Typography components for consistent text styling
 */
import { cn } from '../../../lib/utils';
import { textStyles, labelStyles, errorTextStyles, helpTextStyles } from './Text.style';
import type { TextProps, LabelProps, ErrorTextProps, HelpTextProps } from './Text.types';

/**
 * Text - Typography component for consistent text styling
 */
export function Text({
  variant = 'body',
  as,
  children,
  className,
  ...props
}: TextProps) {
  const { element, styles } = textStyles.variants[variant];
  const Component = as || element;

  return (
    <Component className={cn(styles, className)} {...props}>
      {children}
    </Component>
  );
}

/**
 * Label - Form label component
 */
export function Label({ children, required = false, className, htmlFor, ...props }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(labelStyles.base, className)}
      {...props}
    >
      {children}
      {required && <span className={labelStyles.required}>*</span>}
    </label>
  );
}

/**
 * ErrorText - Error message text
 */
export function ErrorText({ children, className, ...props }: ErrorTextProps) {
  if (!children) return null;

  return (
    <span className={cn(errorTextStyles.base, className)} {...props}>
      {children}
    </span>
  );
}

/**
 * HelpText - Helper text for form fields
 */
export function HelpText({ children, className, ...props }: HelpTextProps) {
  if (!children) return null;

  return (
    <span className={cn(helpTextStyles.base, className)} {...props}>
      {children}
    </span>
  );
}

export default Text;
