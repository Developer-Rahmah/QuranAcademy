/**
 * FormField Component Types
 */
import { ReactNode, ComponentType } from 'react';
import type { SelectOption } from '../../atoms/Select';

export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'date' | 'textarea' | 'select';

export interface FormFieldProps {
  label?: string;
  name: string;
  type?: InputType;
  required?: boolean;
  error?: string;
  help?: string;
  options?: SelectOption[];
  className?: string;
  placeholder?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  disabled?: boolean;
  rows?: number;
}

export interface FormFieldGroupProps {
  children: ReactNode;
  className?: string;
}

export interface IconProps {
  className?: string;
}

export interface FormSectionProps {
  title?: string;
  icon?: ComponentType<IconProps>;
  children: ReactNode;
  className?: string;
}
