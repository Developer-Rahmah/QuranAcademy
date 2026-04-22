/**
 * ContactInfo — thin wrapper around `SocialLinks` kept for backward
 * compatibility with callers that already import ContactInfo.
 *
 * All channel data + icons live in SocialLinks + SettingsContext now; the
 * old `CONTACT_INFO` constant is only a fallback inside SettingsContext.
 */
import { SocialLinks, type SocialLinksVariant, type SocialLinksSize } from '../SocialLinks';

interface ContactInfoProps {
  /** Legacy variant names map onto SocialLinks variants. */
  variant?: 'compact' | 'block';
  size?: SocialLinksSize;
  className?: string;
}

export function ContactInfo({ variant = 'compact', size = 'md', className = '' }: ContactInfoProps) {
  const socialVariant: SocialLinksVariant = variant === 'block' ? 'stacked' : 'inline';
  return <SocialLinks variant={socialVariant} size={size} className={className} />;
}

export default ContactInfo;
