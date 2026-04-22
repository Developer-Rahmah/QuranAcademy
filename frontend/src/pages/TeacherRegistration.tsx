import { AuthLayout, AuthCard } from '../components/templates/AuthLayout';
import { TeacherRegistrationForm } from '../components/organisms/RegistrationForm';
import { useTranslation } from '../locales/i18n';

/**
 * Teacher Registration Page. Title stays neutral at the page level — the
 * form below carries the gendered labels driven by the chosen segment.
 */
export function TeacherRegistration() {
  const { t } = useTranslation();
  return (
    <AuthLayout
      title={t('registration.teacherTitle')}
      subtitle={t('registration.fillAllRequired')}
    >
      <AuthCard>
        <TeacherRegistrationForm />
      </AuthCard>
    </AuthLayout>
  );
}

export default TeacherRegistration;
