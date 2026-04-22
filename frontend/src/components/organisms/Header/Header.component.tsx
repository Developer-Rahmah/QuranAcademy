/**
 * Header Component
 * Dashboard header with user info and logout
 */
import { useAuth } from '../../../context/AuthContext';
import { useTranslation } from '../../../locales/i18n';
import { Button } from '../../atoms/Button';
import { UserIcon, LogoutIcon } from '../../atoms/Icon';
import { Logo } from '../../atoms/Logo';
import { LanguageSwitcher } from '../../atoms/LanguageSwitcher';
import { getDisplayName } from '../../../lib/utils';
import { headerStyles } from './Header.style';
import { segmentationRules } from '../../../lib/segmentationRules';

/**
 * Header - Dashboard header with user info and logout
 */
export function Header() {
  const { t } = useTranslation();
  const { profile, signOut, loading } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <header className={headerStyles.header}>
      <div className={headerStyles.container}>
        <div className={headerStyles.wrapper}>
          {/* User info - Right side in RTL */}
          <div className={headerStyles.userInfo.wrapper}>
            <div className={headerStyles.userInfo.iconWrapper}>
              <UserIcon className={headerStyles.userInfo.icon} />
            </div>
            <div>
              <p className={headerStyles.userInfo.role}>
                {profile && t(segmentationRules.getUserRoleLabel(profile))}
              </p>
              <p className={headerStyles.userInfo.name}>
                {profile ? `أ. ${getDisplayName(profile)}` : ''}
              </p>
            </div>
          </div>

          {/* Logo - Center */}
          <div className={headerStyles.logo.wrapper}>
            <Logo size="sm" />
          </div>

          {/* Language switcher + logout button - Left side in RTL */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={loading}
              className={headerStyles.logoutButton}
            >
              <span>{t('auth.logout')}</span>
              <LogoutIcon className={headerStyles.logoutIcon} />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
