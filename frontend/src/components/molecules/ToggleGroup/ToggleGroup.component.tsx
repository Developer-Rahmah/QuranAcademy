/**
 * ToggleGroup Component
 * Group of toggle buttons (single or multi select)
 */
import { cn } from '../../../lib/utils';
import { toggleGroupStyles } from './ToggleGroup.style';
import type { ToggleGroupProps } from './ToggleGroup.types';

/**
 * ToggleGroup - Group of toggle buttons (single or multi select)
 */
export function ToggleGroup({
  options = [],
  value,
  onChange,
  multiple = false,
  disabled = false,
  size = 'md',
  className,
}: ToggleGroupProps) {
  const isSelected = (optionValue: string): boolean => {
    if (multiple) {
      return Array.isArray(value) && value.includes(optionValue);
    }
    return value === optionValue;
  };

  const handleToggle = (optionValue: string) => {
    if (disabled) return;

    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter((v) => v !== optionValue)
        : [...currentValues, optionValue];
      onChange?.(newValues);
    } else {
      onChange?.(optionValue);
    }
  };

  return (
    <div className={cn(toggleGroupStyles.container, className)}>
      {options.map((option) => {
        const selected = isSelected(option.value);

        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => handleToggle(option.value)}
            className={cn(
              toggleGroupStyles.button.base,
              toggleGroupStyles.button.focus,
              toggleGroupStyles.sizes[size],
              selected
                ? toggleGroupStyles.button.selected
                : toggleGroupStyles.button.unselected,
              disabled && toggleGroupStyles.button.disabled
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default ToggleGroup;
