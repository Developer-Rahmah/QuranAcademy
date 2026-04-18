/**
 * FormField Component
 * Complete form field with label, input, and error/help text
 */
import { forwardRef } from 'react';
import { cn } from '../../../lib/utils';
import { Input, Textarea } from '../../atoms/Input';
import { Select } from '../../atoms/Select';
import { Label, ErrorText, HelpText } from '../../atoms/Text';
import { formFieldStyles, formFieldGroupStyles, formSectionStyles } from './FormField.style';
import type { FormFieldProps, FormFieldGroupProps, FormSectionProps } from './FormField.types';

/**
 * FormField - Complete form field with label, input, and error/help text
 */
export const FormField = forwardRef<
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  FormFieldProps
>(function FormField(
  {
    label,
    name,
    type = 'text',
    required = false,
    error,
    help,
    options = [],
    className,
    ...props
  },
  ref
) {
  const hasError = Boolean(error);

  const renderInput = () => {
    const commonProps = {
      id: name,
      name,
      error: hasError,
      ...props,
    };

    switch (type) {
      case 'textarea':
        return <Textarea ref={ref as React.Ref<HTMLTextAreaElement>} {...commonProps} />;
      case 'select':
        return <Select ref={ref as React.Ref<HTMLSelectElement>} options={options} {...commonProps} />;
      default:
        return <Input ref={ref as React.Ref<HTMLInputElement>} type={type} {...commonProps} />;
    }
  };

  return (
    <div className={cn(formFieldStyles.container, className)}>
      {label && (
        <Label htmlFor={name} required={required}>
          {label}
        </Label>
      )}
      {renderInput()}
      {error && <ErrorText>{error}</ErrorText>}
      {help && !error && <HelpText>{help}</HelpText>}
    </div>
  );
});

/**
 * FormFieldGroup - Group multiple form fields horizontally
 */
export function FormFieldGroup({ children, className }: FormFieldGroupProps) {
  return (
    <div className={cn(formFieldGroupStyles.container, className)}>
      {children}
    </div>
  );
}

/**
 * FormSection - Section wrapper with optional title
 */
export function FormSection({ title, icon: Icon, children, className }: FormSectionProps) {
  return (
    <div className={cn(formSectionStyles.container, className)}>
      {title && (
        <div className={formSectionStyles.header}>
          {Icon && <Icon className={formSectionStyles.icon} />}
          <span>{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}

export default FormField;
