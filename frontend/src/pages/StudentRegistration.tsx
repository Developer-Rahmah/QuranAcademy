import { AuthLayout, AuthCard } from '../components/templates/AuthLayout';
import { StudentRegistrationForm } from '../components/organisms/RegistrationForm';

/**
 * Student Registration Page
 */
export function StudentRegistration() {
  return (
    <AuthLayout
      title="تسجيل طالبة"
      subtitle="يرجى ملء جميع الحقول المطلوبة"
    >
      <AuthCard>
        <StudentRegistrationForm />
      </AuthCard>
    </AuthLayout>
  );
}

export default StudentRegistration;
