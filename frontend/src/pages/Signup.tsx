import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout, AuthCard } from '../components/templates/AuthLayout';
import { Button } from '../components/atoms/Button';
import { UsersIcon, TeacherIcon } from '../components/atoms/Icon';
import { cn } from '../lib/utils';
import { useTranslation } from '../locales/i18n';
import type { IconProps } from '../types';

interface AccountType {
  id: string;
  label: string;
  icon: React.ComponentType<IconProps>;
  description: string;
  path: string;
}

/**
 * Signup Page - Account type selection
 */
export function Signup() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const accountTypes: AccountType[] = [
    {
      id: 'student',
      label: t('auth.student'),
      icon: TeacherIcon,
      description: t('auth.studentDesc'),
      path: '/register/student',
    },
    {
      id: 'teacher',
      label: t('auth.teacher'),
      icon: UsersIcon,
      description: t('auth.teacherDesc'),
      path: '/register/teacher',
    },
  ];

  const handleContinue = () => {
    if (!selectedType) return;
    const selected = accountTypes.find((t) => t.id === selectedType);
    if (selected) {
      navigate(selected.path);
    }
  };

  return (
    <AuthLayout
      title={t('auth.createNewAccount')}
      subtitle={t('auth.selectAccountType')}
    >
      <AuthCard>
        <div className="space-y-6">
          {/* Account type selection */}
          <div className="grid grid-cols-2 gap-4">
            {accountTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;

              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type.id)}
                  className={cn(
                    'p-6 rounded-xl border-2 transition-all text-center',
                    'focus:outline-none focus:ring-2 focus:ring-primary/20',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <div className="w-12 h-12 mx-auto mb-3 bg-secondary rounded-full flex items-center justify-center">
                    <Icon className="w-6 h-6 text-foreground" />
                  </div>
                  <p className="font-medium text-foreground">{type.label}</p>
                </button>
              );
            })}
          </div>

          {/* Continue button */}
          <Button
            size="full"
            onClick={handleContinue}
            disabled={!selectedType}
            className={cn(!selectedType && 'opacity-60')}
          >
            {t('common.continue')}
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
          </div>

          {/* Login link */}
          <p className="text-center text-sm text-muted">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-primary hover:underline">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}

export default Signup;
