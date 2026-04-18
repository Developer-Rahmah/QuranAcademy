/**
 * ToggleGroup Component Types
 */

export interface ToggleOption {
  value: string;
  label: string;
}

export type ToggleSize = 'sm' | 'md' | 'lg';

export interface ToggleGroupProps {
  options?: ToggleOption[];
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  size?: ToggleSize;
  className?: string;
}
