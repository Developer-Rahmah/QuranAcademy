import { AuthLayout, AuthCard } from '../components/templates/AuthLayout';
import { SupervisorRegistrationForm } from '../components/organisms/RegistrationForm';
import { useTranslation } from '../locales/i18n';

/**
 * Volunteer Supervisor Registration Page. Title stays neutral at the page
 * level — the form below carries the gendered labels (male/female volunteer
 * supervisor) driven by the chosen segment, and the unpaid-volunteer notice.
 */
export function SupervisorRegistration() {
  const { t } = useTranslation();
  return (
    <AuthLayout
      title={t('registration.supervisorTitle')}
      subtitle={t('registration.fillAllRequired')}
    >
      <AuthCard>
        <SupervisorRegistrationForm />
      </AuthCard>
    </AuthLayout>
  );
}

export default SupervisorRegistration;
