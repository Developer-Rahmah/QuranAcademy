/**
 * Button Component
 * Primary interactive element
 */
import { cn } from '../../../lib/utils';
import { useTranslation } from '../../../locales/i18n';
import { buttonStyles } from './Button.style';
import type { ButtonProps } from './Button.types';

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  children,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  const { t } = useTranslation();

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        buttonStyles.base,
        buttonStyles.variants[variant],
        buttonStyles.sizes[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner />
          <span>{t('common.loading')}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className={buttonStyles.spinner.container}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className={buttonStyles.spinner.circle}
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className={buttonStyles.spinner.path}
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default Button;
