/**
 * Checkbox Component
 * Checkbox input component
 */
import { forwardRef } from 'react';
import { cn } from '../../../lib/utils';
import { checkboxStyles } from './Checkbox.style';
import type { CheckboxProps } from './Checkbox.types';

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  {
    label,
    checked,
    disabled = false,
    error = false,
    className,
    ...props
  },
  ref
) {
  return (
    <label
      className={cn(
        checkboxStyles.container.base,
        disabled && checkboxStyles.container.disabled,
        className
      )}
    >
      <div className={checkboxStyles.wrapper}>
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          className={checkboxStyles.input}
          {...props}
        />
        <div
          className={cn(
            checkboxStyles.box.base,
            checkboxStyles.box.checked,
            checkboxStyles.box.focus,
            error ? checkboxStyles.box.error : checkboxStyles.box.normal,
            disabled ? checkboxStyles.box.disabled : checkboxStyles.box.enabled
          )}
        />
        <svg
          className={cn(
            checkboxStyles.icon.base,
            checked ? checkboxStyles.icon.checked : checkboxStyles.icon.unchecked
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      {label && <span className={checkboxStyles.label}>{label}</span>}
    </label>
  );
});

export default Checkbox;
