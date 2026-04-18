import { AuthLayout, AuthCard } from '../components/templates/AuthLayout';
import { TeacherRegistrationForm } from '../components/organisms/RegistrationForm';

/**
 * Teacher Registration Page
 */
export function TeacherRegistration() {
  return (
    <AuthLayout
      title="تسجيل معلمة"
      subtitle="يرجى ملء جميع الحقول المطلوبة"
    >
      <AuthCard>
        <TeacherRegistrationForm />
      </AuthCard>
    </AuthLayout>
  );
}

export default TeacherRegistration;
