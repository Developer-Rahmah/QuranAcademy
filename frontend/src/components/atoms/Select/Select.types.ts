/**
 * Select Component Types
 */
import { SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value'> {
  options: SelectOption[];
  error?: boolean;
  value?: string;
  placeholder?: string;
}
