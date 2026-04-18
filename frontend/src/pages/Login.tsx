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

    // Success - navigate to dashboard
    toast.success(t('dashboard.welcome'));
    navigate('/dashboard');
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
            placeholder={t('auth.enterEmailOrPhone')}
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            error={errors.email}
          />

          <FormField
            label={t('auth.password')}
            name="password"
            type="password"
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
