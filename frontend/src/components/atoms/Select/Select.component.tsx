/**
 * Select Component
 * Dropdown select input
 */
import { forwardRef } from 'react';
import { cn } from '../../../lib/utils';
import { useTranslation } from '../../../locales/i18n';
import { selectStyles } from './Select.style';
import type { SelectProps } from './Select.types';

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    options = [],
    placeholder,
    disabled = false,
    error = false,
    className,
    value,
    ...props
  },
  ref
) {
  const { t } = useTranslation();
  const placeholderText = placeholder || t('common.select');

  return (
    <div className={selectStyles.wrapper}>
      <select
        ref={ref}
        disabled={disabled}
        value={value || ''}
        className={cn(
          selectStyles.select.base,
          selectStyles.select.focus,
          selectStyles.select.disabled,
          error ? selectStyles.select.error : selectStyles.select.normal,
          !value && selectStyles.select.placeholder,
          className
        )}
        {...props}
      >
        <option value="" disabled>
          {placeholderText}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className={selectStyles.icon.wrapper}>
        <svg
          className={selectStyles.icon.svg}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
});

export default Select;
