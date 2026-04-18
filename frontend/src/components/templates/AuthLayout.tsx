import { ReactNode } from 'react';
import { BookIcon } from '../atoms/Icon';

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
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main content area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {/* Logo */}
        <div className="mb-6">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
            <BookIcon className="w-8 h-8 text-white" />
          </div>
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

      {/* Footer with hadith */}
      <footer className="py-6 text-center">
        <p className="text-muted text-sm">
          خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ
        </p>
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
