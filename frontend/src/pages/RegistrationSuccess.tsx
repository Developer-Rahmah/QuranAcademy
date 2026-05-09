import { Link } from 'react-router-dom';
import { AuthLayout, AuthCard } from '../components/templates/AuthLayout';
import { Button } from '../components/atoms/Button';
import { Card } from '../components/molecules/Card';
import { CheckCircleIcon, ChatIcon } from '../components/atoms/Icon';
import { useTranslation } from '../locales/i18n';

/**
 * Registration Success Page - Shown after successful registration
 */
export function RegistrationSuccess() {
  const { t } = useTranslation();

  return (
    <AuthLayout>
      <AuthCard>
        <div className="text-center space-y-6">
          {/* Success icon */}
          <div className="w-20 h-20 mx-auto bg-success/10 rounded-full flex items-center justify-center">
            <CheckCircleIcon className="w-10 h-10 text-success" />
          </div>

          {/* Title */}
          <div>
            <h1 className="text-xl font-medium text-foreground mb-2">
              {t('registration.successHeadline')}
            </h1>
            <p className="text-muted">
              {t('registration.successMessage')}
            </p>
          </div>

          {/* Info card */}
          <Card variant="bordered" padding="md">
            <div className="flex items-start gap-3">
              <ChatIcon className="w-5 h-5 text-muted flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted text-start">
                {t('registration.successWhatsapp')}
              </p>
            </div>
          </Card>

          {/* Processing time */}
          <p className="text-sm text-muted">
            {t('registration.successProcessingTime')}
          </p>

          {/* Back to login button */}
          <Link to="/login">
            <Button size="full">
              {t('registration.backToLogin')}
            </Button>
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}

export default RegistrationSuccess;
