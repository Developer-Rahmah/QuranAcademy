import { AuthLayout, AuthCard } from '../components/templates/AuthLayout';
import { StudentRegistrationForm } from '../components/organisms/RegistrationForm';
import { useTranslation } from '../locales/i18n';

/**
 * Student Registration Page. Title stays neutral at the page level — the
 * form below carries the gendered labels driven by the chosen segment.
 */
export function StudentRegistration() {
  const { t } = useTranslation();
  return (
    <AuthLayout
      title={t('registration.studentTitle')}
      subtitle={t('registration.fillAllRequired')}
    >
      <AuthCard>
        <StudentRegistrationForm />
      </AuthCard>
    </AuthLayout>
  );
}

export default StudentRegistration;
