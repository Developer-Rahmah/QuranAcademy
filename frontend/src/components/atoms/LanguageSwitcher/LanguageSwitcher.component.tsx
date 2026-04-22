/**
 * LanguageSwitcher — toggles AR ↔ EN through the i18n provider.
 *
 * The provider already persists the choice to localStorage and exposes
 * `isRTL`, so this atom only needs to render a labelled toggle button.
 * Placed in headers (auth + dashboard) and the landing page so users can
 * switch from any surface.
 */
import { useTranslation } from '../../../locales/i18n';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'pill' | 'minimal';
}

export function LanguageSwitcher({
  className = '',
  variant = 'pill',
}: LanguageSwitcherProps) {
  const { language, setLanguage } = useTranslation();
  const next = language === 'ar' ? 'en' : 'ar';
  const label = next === 'ar' ? 'العربية' : 'English';

  const baseCls =
    variant === 'minimal'
      ? 'text-sm text-muted hover:text-primary transition-colors'
      : 'inline-flex items-center justify-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors';

  return (
    <button
      type="button"
      onClick={() => setLanguage(next)}
      aria-label={`Switch language to ${label}`}
      className={`${baseCls} ${className}`}
    >
      {label}
    </button>
  );
}

export default LanguageSwitcher;
