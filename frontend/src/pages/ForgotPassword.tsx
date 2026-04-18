import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthLayout, AuthCard } from '../components/templates/AuthLayout';
import { FormField } from '../components/molecules/FormField';
import { Button } from '../components/atoms/Button';
import { Card } from '../components/molecules/Card';
import { MailIcon } from '../components/atoms/Icon';
import { isValidEmail, getErrorMessage } from '../lib/utils';

/**
 * Forgot Password Page - Password reset request
 */
export function ForgotPassword() {
  const { resetPassword, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('البريد الإلكتروني مطلوب');
      return;
    }

    if (!isValidEmail(email)) {
      setError('البريد الإلكتروني غير صحيح');
      return;
    }

    const { error: resetError } = await resetPassword(email);

    if (resetError) {
      setError(getErrorMessage(resetError));
      return;
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <AuthLayout title="نسيت كلمة المرور">
        <AuthCard>
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-success/10 rounded-full flex items-center justify-center">
              <MailIcon className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-lg font-medium text-foreground">
              تم إرسال رابط إعادة التعيين
            </h2>
            <p className="text-sm text-muted">
              يرجى التحقق من بريدك الإلكتروني واتباع التعليمات لإعادة تعيين كلمة المرور
            </p>
            <Link to="/">
              <Button variant="outline" size="full" className="mt-4">
                العودة إلى تسجيل الدخول
              </Button>
            </Link>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="نسيت كلمة المرور"
      subtitle="أدخل بريدك الإلكتروني لإعادة تعيين كلمة المرور"
    >
      <AuthCard>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          <FormField
            label="البريد الإلكتروني"
            name="email"
            type="email"
            placeholder="أدخل البريد الإلكتروني"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            error={error && !email ? error : ''}
          />

          {/* Info card */}
          <Card variant="bordered" padding="md">
            <div className="flex items-start gap-3">
              <MailIcon className="w-5 h-5 text-muted flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted">
                سيتم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني
              </p>
            </div>
          </Card>

          <Button type="submit" size="full" loading={loading}>
            إرسال الرابط
          </Button>

          <p className="text-center text-sm text-muted">
            <Link to="/" className="text-primary hover:underline">
              العودة إلى تسجيل الدخول
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}

export default ForgotPassword;
