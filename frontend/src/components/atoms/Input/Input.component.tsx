/**
 * Input Component
 * Text input and textarea fields
 */
import { forwardRef } from 'react';
import { cn } from '../../../lib/utils';
import { inputStyles, textareaStyles } from './Input.style';
import type { InputProps, TextareaProps } from './Input.types';

/**
 * Input - Single line text input field
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    type = 'text',
    placeholder,
    disabled = false,
    error = false,
    className,
    ...props
  },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        inputStyles.base,
        inputStyles.focus,
        inputStyles.disabled,
        error ? inputStyles.error : inputStyles.normal,
        className
      )}
      {...props}
    />
  );
});

/**
 * Textarea - Multi-line text input
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    placeholder,
    disabled = false,
    error = false,
    rows = 4,
    className,
    ...props
  },
  ref
) {
  return (
    <textarea
      ref={ref}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      className={cn(
        textareaStyles.base,
        textareaStyles.focus,
        textareaStyles.disabled,
        error ? textareaStyles.error : textareaStyles.normal,
        className
      )}
      {...props}
    />
  );
});

export default Input;
