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
  // Accept numbers too — FormField forwards numeric values for <FormField type="number" />
  // and the native <select> happily coerces them.
  value?: string | number;
  placeholder?: string;
}
