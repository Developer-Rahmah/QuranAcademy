/**
 * Header Component
 * Dashboard header with user info and logout
 */
import { useAuth } from '../../../context/AuthContext';
import { useTranslation } from '../../../locales/i18n';
import { Button } from '../../atoms/Button';
import { UserIcon, LogoutIcon, BookIcon } from '../../atoms/Icon';
import { ROLE_LABELS } from '../../../lib/constants';
import { getDisplayName } from '../../../lib/utils';
import { headerStyles } from './Header.style';
import type { UserRole } from '../../../types';

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
                {profile?.role && ROLE_LABELS[profile.role as UserRole]}
              </p>
              <p className={headerStyles.userInfo.name}>
                {profile ? `أ. ${getDisplayName(profile)}` : ''}
              </p>
            </div>
          </div>

          {/* Logo - Center (optional) */}
          <div className={headerStyles.logo.wrapper}>
            <div className={headerStyles.logo.iconWrapper}>
              <BookIcon className={headerStyles.logo.icon} />
            </div>
          </div>

          {/* Logout button - Left side in RTL */}
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
    </header>
  );
}

export default Header;
