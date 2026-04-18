import { ReactNode } from 'react';
import { Header } from '../organisms/Header';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

/**
 * DashboardLayout - Layout for authenticated dashboard pages
 * Includes header with user info and logout
 */
export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        {(title || subtitle) && (
          <div className="mb-8 text-center sm:text-right">
            {title && (
              <h1 className="text-2xl font-medium text-foreground">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-muted mt-1">{subtitle}</p>
            )}
          </div>
        )}

        {/* Page content */}
        {children}
      </main>
    </div>
  );
}

interface PageSectionProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * PageSection - Section wrapper within dashboard
 */
export function PageSection({ title, action, children, className }: PageSectionProps) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h2 className="text-lg font-medium text-foreground">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export default DashboardLayout;
