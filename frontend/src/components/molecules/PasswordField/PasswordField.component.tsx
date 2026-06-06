/**
 * PasswordField — labelled password input with an eye-toggle.
 *
 * API mirrors `FormField` for type='password' (label / name / required /
 * value / onChange / error) so swapping a call site is a one-line edit.
 * The toggle button flips the input between `password` and `text`; an
 * accessible label and `aria-pressed` state are emitted so screen
 * readers announce the change.
 *
 * Why not extend FormField/Input directly: keeping the toggle scoped
 * here means the rest of the form-field API stays unchanged for the
 * many text/email/number inputs that don't need it, and we don't have
 * to invent a `passwordToggle` prop that's irrelevant elsewhere.
 */
import { useState, forwardRef } from 'react';
import { cn } from '../../../lib/utils';
import { Input } from '../../atoms/Input';
import { Label, ErrorText, HelpText } from '../../atoms/Text';
import { EyeIcon, EyeOffIcon } from '../../atoms/Icon';
import { useTranslation } from '../../../locales/i18n';

export interface PasswordFieldProps {
  label?: string;
  name?: string;
  required?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  error?: string;
  help?: string;
  className?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    {
      label,
      name,
      required = false,
      value,
      onChange,
      placeholder,
      autoComplete = 'current-password',
      disabled = false,
      error,
      help,
      className,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const [revealed, setRevealed] = useState(false);
    const hasError = Boolean(error);

    return (
      <div className={cn('space-y-1', className)}>
        {label && (
          <Label htmlFor={name} required={required}>
            {label}
          </Label>
        )}
        <div className="relative">
          <Input
            ref={ref}
            id={name}
            name={name}
            type={revealed ? 'text' : 'password'}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            autoComplete={autoComplete}
            disabled={disabled}
            error={hasError}
            // Reserve room on the inline-end side for the toggle so the
            // typed characters never slide under it (works in both LTR
            // and RTL — Tailwind's logical `pe-12` flips with `dir`).
            className="pe-12"
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => setRevealed((v) => !v)}
            aria-pressed={revealed}
            aria-label={t(revealed ? 'auth.hidePassword' : 'auth.showPassword')}
            className="absolute inset-y-0 end-2 my-auto flex h-9 w-9 items-center justify-center rounded-md text-muted hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {revealed ? (
              <EyeOffIcon className="w-5 h-5" />
            ) : (
              <EyeIcon className="w-5 h-5" />
            )}
          </button>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
        {help && !error && <HelpText>{help}</HelpText>}
      </div>
    );
  },
);

export default PasswordField;
