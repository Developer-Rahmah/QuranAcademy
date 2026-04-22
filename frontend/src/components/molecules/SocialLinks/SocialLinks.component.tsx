/**
 * SocialLinks — settings-driven icon row for contact channels.
 *
 * URLs come from `useSettings().contact`, which is sourced from the Supabase
 * `settings` table (with safe fallbacks). Icons come from lucide-react where
 * available, and from our own brand atoms for marks lucide doesn't ship in
 * the pinned major (Facebook, Instagram).
 *
 * Empty channels are hidden so clearing a value in the admin settings page
 * effectively removes the icon from every surface.
 */
import type { ComponentType } from 'react';
import { Mail, type LucideProps } from 'lucide-react';
import { FacebookIcon, InstagramIcon, WhatsappIcon } from '../../atoms/Icon';
import type { IconProps } from '../../atoms/Icon';
import { useSettings } from '../../../context/SettingsContext';
import { useTranslation } from '../../../locales/i18n';

export type SocialLinksVariant = 'inline' | 'stacked';
export type SocialLinksSize = 'sm' | 'md' | 'lg';

interface SocialLinksProps {
  variant?: SocialLinksVariant;
  size?: SocialLinksSize;
  className?: string;
}

type AnyIconComponent = ComponentType<IconProps> | ComponentType<LucideProps>;

interface Channel {
  key: 'facebook' | 'instagram' | 'whatsapp' | 'email';
  href: string;
  labelKey: string;
  Icon: AnyIconComponent;
}

const SIZE_PX: Record<SocialLinksSize, number> = { sm: 16, md: 20, lg: 24 };
const SIZE_TO_CHIP: Record<SocialLinksSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

function buildChannels(
  contact: ReturnType<typeof useSettings>['contact'],
): Channel[] {
  const out: Channel[] = [];

  if (contact.facebook) {
    out.push({
      key: 'facebook',
      href: contact.facebook,
      labelKey: 'contact.facebook',
      Icon: FacebookIcon,
    });
  }
  if (contact.instagram) {
    out.push({
      key: 'instagram',
      href: contact.instagram,
      labelKey: 'contact.instagram',
      Icon: InstagramIcon,
    });
  }
  if (contact.whatsapp) {
    const digits = contact.whatsapp.replace(/\D/g, '');
    out.push({
      key: 'whatsapp',
      href: digits ? `https://wa.me/${digits}` : contact.whatsapp,
      labelKey: 'contact.whatsapp',
      Icon: WhatsappIcon,
    });
  }
  if (contact.email) {
    out.push({
      key: 'email',
      href: contact.email.startsWith('mailto:')
        ? contact.email
        : `mailto:${contact.email}`,
      labelKey: 'contact.email',
      Icon: Mail,
    });
  }

  return out;
}

export function SocialLinks({
  variant = 'inline',
  size = 'md',
  className = '',
}: SocialLinksProps) {
  const { t } = useTranslation();
  const { contact } = useSettings();
  const channels = buildChannels(contact);

  if (channels.length === 0) return null;

  const wrapperCls =
    variant === 'stacked'
      ? 'flex flex-col items-center gap-2'
      : 'flex items-center justify-center gap-3 flex-wrap';

  const iconPx = SIZE_PX[size];

  return (
    <nav aria-label={t('contact.title')} className={`${wrapperCls} ${className}`}>
      {channels.map(({ key, href, labelKey, Icon }) => {
        const label = t(labelKey);
        // lucide icons accept `size` in px; our local atoms accept a `size`
        // token. Feed both via width/height so everything renders at the
        // same visual size regardless of origin.
        return (
          <a
            key={key}
            href={href}
            target={key === 'email' ? undefined : '_blank'}
            rel={key === 'email' ? undefined : 'noopener noreferrer'}
            aria-label={label}
            title={label}
            className={`${SIZE_TO_CHIP[size]} inline-flex items-center justify-center rounded-full bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30`}
          >
            <Icon width={iconPx} height={iconPx} />
          </a>
        );
      })}
    </nav>
  );
}

export default SocialLinks;
