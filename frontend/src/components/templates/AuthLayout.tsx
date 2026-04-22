import { ReactNode } from 'react';
import { Logo } from '../atoms/Logo';
import { LanguageSwitcher } from '../atoms/LanguageSwitcher';
import { SocialLinks } from '../molecules/SocialLinks';
import { useTranslation } from '../../locales/i18n';
import { useSettings } from '../../context/SettingsContext';

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

/**
 * AuthLayout - Layout for authentication pages (login, signup, registration)
 * Centers content with logo and optional hadith quote at bottom
 */
export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const { t } = useTranslation();
  const { academyDescription } = useSettings();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar — language switcher only, no other chrome on auth pages. */}
      <div className="flex justify-end px-4 pt-4">
        <LanguageSwitcher />
      </div>

      {/* Main content area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {/* Logo */}
        <div className="mb-6">
          <Logo size="md" className="shadow-sm" />
        </div>

        {/* Title */}
        {title && (
          <h1 className="text-2xl font-medium text-foreground text-center mb-2">
            {title}
          </h1>
        )}

        {/* Subtitle */}
        {subtitle && (
          <p className="text-muted text-center mb-8">{subtitle}</p>
        )}

        {/* Content */}
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Footer: description (from settings) + hadith + social icons */}
      <footer className="py-6 px-4 text-center space-y-3 border-t border-border/50">
        <p className="text-muted text-sm max-w-xl mx-auto">
          {academyDescription}
        </p>
        <p className="text-muted text-sm">
          {t('academy.hadith')}
        </p>
        <SocialLinks size="sm" />
      </footer>
    </div>
  );
}

interface AuthCardProps {
  children: ReactNode;
}

/**
 * AuthCard - Card wrapper for auth forms
 */
export function AuthCard({ children }: AuthCardProps) {
  return (
    <div className="bg-card rounded-2xl shadow-lg p-6 sm:p-8">
      {children}
    </div>
  );
}

export default AuthLayout;
