/**
 * Landing — public marketing page at `/`.
 *
 * Hero + value-prop strip + contact footer. All copy is i18n-driven and the
 * brand text comes from `useSettings()` so admins can swap the academy
 * name/description without a deploy.
 */
import { Link } from 'react-router-dom';
import { Logo } from '../components/atoms/Logo';
import { Button } from '../components/atoms/Button';
import { LanguageSwitcher } from '../components/atoms/LanguageSwitcher';
import { SocialLinks } from '../components/molecules/SocialLinks';
import { useTranslation } from '../locales/i18n';
import { useSettings } from '../context/SettingsContext';
import { ROUTES } from '../lib/routes';

interface FeatureCardProps {
  title: string;
  description: string;
}

function FeatureCard({ title, description }: FeatureCardProps) {
  return (
    <div className="flex-1 min-w-[240px] p-6 bg-card rounded-2xl border border-border shadow-sm text-center">
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-base text-muted leading-relaxed">{description}</p>
    </div>
  );
}

export function Landing() {
  const { t } = useTranslation();
  const { academyName, academyDescription } = useSettings();

  const features = [
    { title: t('landing.feature1Title'), description: t('landing.feature1Desc') },
    { title: t('landing.feature2Title'), description: t('landing.feature2Desc') },
    { title: t('landing.feature3Title'), description: t('landing.feature3Desc') },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="text-base font-semibold text-foreground">{academyName}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link to={ROUTES.login}>
            <Button variant="outline" size="sm">
              {t('landing.login')}
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <Logo size="xl" className="mb-6 shadow-md" />

        <h1 className="text-3xl sm:text-5xl font-semibold text-foreground mb-3">
          {academyName}
        </h1>
        <p className="text-lg text-muted mb-6">{t('academy.subtitle')}</p>
        <p className="max-w-2xl text-base sm:text-lg text-foreground/80 leading-relaxed mb-10">
          {academyDescription}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
          <Link to={ROUTES.signup} className="w-full">
            <Button size="full">{t('landing.register')}</Button>
          </Link>
          <Link to={ROUTES.login} className="w-full">
            <Button size="full" variant="outline">
              {t('landing.login')}
            </Button>
          </Link>
        </div>

        <p className="mt-10 text-muted text-base italic max-w-xl">
          {t('academy.hadith')}
        </p>
      </section>

      {/* Features */}
      <section className="px-4 sm:px-8 py-12 bg-secondary/40">
        <h2 className="text-2xl sm:text-3xl font-semibold text-foreground text-center mb-8">
          {t('landing.featuresTitle')}
        </h2>
        <div className="max-w-5xl mx-auto flex flex-wrap gap-6 justify-center">
          {features.map((f) => (
            <FeatureCard key={f.title} title={f.title} description={f.description} />
          ))}
        </div>
      </section>

      {/* Contact footer */}
      <footer className="py-8 px-4 text-center border-t border-border/50">
        <h2 className="text-base font-medium text-foreground mb-4">
          {t('contact.title')}
        </h2>
        <SocialLinks size="md" />
      </footer>
    </div>
  );
}

export default Landing;
