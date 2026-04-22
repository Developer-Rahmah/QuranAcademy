/**
 * Login Page - User authentication with toast notifications
 */
import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTranslation } from '../locales/i18n';
import { AuthLayout, AuthCard } from '../components/templates/AuthLayout';
import { FormField } from '../components/molecules/FormField';
import { Button } from '../components/atoms/Button';
import { isValidEmail } from '../lib/utils';
import { getErrorMessage } from '../lib/errorHandler';
import { ROUTES } from '../lib/routes';

// ============================================
// Types
// ============================================
interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  [key: string]: string;
}

// ============================================
// Styles
// ============================================
const loginStyles = {
  form: 'space-y-6',
  errorBox: 'p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm',
  links: 'text-center space-y-3',
  forgotPassword: 'block text-sm text-muted hover:text-primary',
  signupText: 'text-sm text-muted',
  signupLink: 'text-primary hover:underline',
  devLink: 'mt-6 text-center',
  devLinkText: 'text-xs text-muted hover:underline',
};

// ============================================
// Login Page
// ============================================
export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { signIn, loading } = useAuth();

  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // Handle field change
  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = t('validation.emailRequired');
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = t('validation.emailInvalid');
    }

    if (!formData.password) {
      newErrors.password = t('validation.passwordRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submit
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.warning(t('validation.fixErrors'));
      return;
    }

    const { error } = await signIn(formData.email, formData.password);

    if (error) {
      const errorMsg = getErrorMessage(error);
      setErrors({ submit: errorMsg });
      toast.error(errorMsg);
      return;
    }

    // Success — navigate immediately to the neutral dashboard entrypoint.
    // The DashboardDispatcher there reads the profile role as soon as it
    // hydrates and redirects to /admin for admins, or renders the correct
    // role component for teachers/students. This keeps login→redirect
    // snappy even if the profile SELECT is still in flight.
    toast.success(t('dashboard.welcome'));
    navigate(ROUTES.dashboard, { replace: true });
  };

  return (
    <AuthLayout
      title={t('academy.title')}
      subtitle={t('academy.subtitle')}
    >
      <AuthCard>
        <form onSubmit={handleSubmit} className={loginStyles.form}>
          {errors.submit && (
            <div className={loginStyles.errorBox}>
              {errors.submit}
            </div>
          )}

          <FormField
            label={t('auth.emailOrPhone')}
            name="email"
            type="email"
            required
            placeholder={t('auth.enterEmailOrPhone')}
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            error={errors.email}
          />

          <FormField
            label={t('auth.password')}
            name="password"
            type="password"
            required
            placeholder={t('auth.enterPassword')}
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            error={errors.password}
          />

          <Button type="submit" size="full" loading={loading}>
            {t('auth.login')}
          </Button>

          <div className={loginStyles.links}>
            <Link to="/forgot-password" className={loginStyles.forgotPassword}>
              {t('auth.forgotPassword')}
            </Link>

            <p className={loginStyles.signupText}>
              {t('auth.noAccount')}{' '}
              <Link to="/signup" className={loginStyles.signupLink}>
                {t('auth.createNewAccount')}
              </Link>
            </p>
          </div>
        </form>
      </AuthCard>

      {/* Developer link - can be removed in production */}
      <p className={loginStyles.devLink}>
        <Link to="/dev" className={loginStyles.devLinkText}>
          {t('developer.viewAllPages')}
        </Link>
      </p>
    </AuthLayout>
  );
}

export default Login;
