/**
 * MeetLinkCard Component
 * Card displaying Google Meet link with copy functionality
 */
import { useState } from 'react';
import { cn, copyToClipboard } from '../../../lib/utils';
import { useTranslation } from '../../../locales/i18n';
import { Card } from '../Card';
import { VideoIcon, CopyIcon, CheckIcon } from '../../atoms/Icon';
import { meetLinkCardStyles } from './MeetLinkCard.style';
import type { MeetLinkCardProps } from './MeetLinkCard.types';

/**
 * MeetLinkCard - Card displaying Google Meet link with copy functionality
 */
export function MeetLinkCard({ link, className }: MeetLinkCardProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!link) return;
    const success = await copyToClipboard(link);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenLink = () => {
    if (!link) return;
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  if (!link) {
    return (
      <Card padding="md" className={cn(meetLinkCardStyles.empty, className)}>
        <p className={meetLinkCardStyles.emptyText}>{t('halaqah.noLink')}</p>
      </Card>
    );
  }

  return (
    <Card padding="md" className={className}>
      <div className={meetLinkCardStyles.header.wrapper}>
        <span className={meetLinkCardStyles.header.label}>{t('halaqah.meetLink')}</span>
        <VideoIcon className={meetLinkCardStyles.header.icon} />
      </div>

      <div className={meetLinkCardStyles.linkContainer}>
        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className={meetLinkCardStyles.copyButton.base}
          title={t('halaqah.copyLink')}
        >
          {copied ? (
            <CheckIcon className={meetLinkCardStyles.copyButton.checkIcon} />
          ) : (
            <CopyIcon className={meetLinkCardStyles.copyButton.copyIcon} />
          )}
        </button>

        {/* Link display */}
        <button
          type="button"
          onClick={handleOpenLink}
          className={meetLinkCardStyles.linkButton}
        >
          {link}
        </button>

        {/* Open button */}
        <button
          type="button"
          onClick={handleOpenLink}
          className={meetLinkCardStyles.openButton.base}
          title={t('halaqah.joinMeet')}
        >
          <VideoIcon className={meetLinkCardStyles.openButton.icon} />
        </button>
      </div>
    </Card>
  );
}

export default MeetLinkCard;
