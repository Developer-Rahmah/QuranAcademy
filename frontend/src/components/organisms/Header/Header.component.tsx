/**
 * Header Component
 * Dashboard header with user info and logout.
 *
 * Mobile responsiveness rules (see Header.style.ts for the full
 * rationale):
 *
 *   - The user-info block is the only flexible cell — long names
 *     truncate via `min-w-0 + flex-1 + truncate` rather than wrapping.
 *   - Action buttons collapse their text labels below `sm` and stay
 *     square via fixed min-height; this keeps AR/EN button widths
 *     identical so toggling language never reflows the header.
 *   - The logo is hidden under `sm` to give the user block more room.
 */
import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useTranslation } from '../../../locales/i18n';
import { Button } from '../../atoms/Button';
import { UserIcon, LogoutIcon, ChatIcon } from '../../atoms/Icon';
import { Logo } from '../../atoms/Logo';
import { LanguageSwitcher } from '../../atoms/LanguageSwitcher';
import { getDisplayName } from '../../../lib/utils';
import { FeedbackModal } from '../FeedbackModal';
import { headerStyles } from './Header.style';
import { segmentationRules } from '../../../lib/segmentationRules';

/**
 * Header - Dashboard header with user info and logout
 */
export function Header() {
  const { t, language } = useTranslation();
  const { profile, signOut, loading } = useAuth();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
  };

  const feedbackLabel = t('feedback.button');
  const logoutLabel = t('auth.logout');
  // The honorific "أ." (أستاذ/أستاذة) only makes sense in Arabic.
  // Render the bare display name in English so we don't ship Arabic
  // characters into LTR layouts.
  const displayName = profile ? getDisplayName(profile) : '';
  const headerName = profile
    ? language === 'ar'
      ? `أ. ${displayName}`
      : displayName
    : '';

  return (
    <header className={headerStyles.header}>
      <div className={headerStyles.container}>
        <div className={headerStyles.wrapper}>
          {/* User info — flexible, truncates on overflow. */}
          <div className={headerStyles.userInfo.wrapper}>
            <div className={headerStyles.userInfo.iconWrapper}>
              <UserIcon className={headerStyles.userInfo.icon} />
            </div>
            <div className={headerStyles.userInfo.textBlock}>
              <p className={headerStyles.userInfo.role}>
                {profile && t(segmentationRules.getUserRoleLabel(profile))}
              </p>
              <p
                className={headerStyles.userInfo.name}
                title={displayName}
              >
                {headerName}
              </p>
            </div>
          </div>

          {/* Logo - hidden on the smallest viewports. */}
          <div className={headerStyles.logo.wrapper}>
            <Logo size="sm" />
          </div>

          {/* Right cluster — language toggle + feedback + logout. Fixed
              shape so AR/EN parity holds. */}
          <div className={headerStyles.actions}>
            <LanguageSwitcher />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFeedbackOpen(true)}
              className={headerStyles.iconButton}
              aria-label={feedbackLabel}
              title={feedbackLabel}
            >
              <ChatIcon className={headerStyles.logoutIcon} />
              <span className={headerStyles.labelInline}>{feedbackLabel}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={loading}
              className={headerStyles.iconButton}
              aria-label={logoutLabel}
              title={logoutLabel}
            >
              <LogoutIcon className={headerStyles.logoutIcon} />
              <span className={headerStyles.labelInline}>{logoutLabel}</span>
            </Button>
          </div>
        </div>
      </div>
      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </header>
  );
}

export default Header;
