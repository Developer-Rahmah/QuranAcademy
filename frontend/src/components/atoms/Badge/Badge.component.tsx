/**
 * Badge Component
 * Small status indicator or label
 */
import { cn } from '../../../lib/utils';
import { useTranslation } from '../../../locales/i18n';
import { badgeStyles } from './Badge.style';
import type { BadgeProps, StatusBadgeProps, StatusConfig, StatusType, BadgeVariant } from './Badge.types';

/**
 * Badge - Small status indicator or label
 */
export function Badge({
  variant = 'default',
  size = 'md',
  children,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        badgeStyles.base,
        badgeStyles.variants[variant],
        badgeStyles.sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * StatusBadge - Badge with status icon
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation();

  const statusConfig: Record<StatusType, StatusConfig> = {
    active: { label: t('status.active'), variant: 'success', icon: CheckIcon },
    pending: { label: t('status.pending'), variant: 'warning', icon: ClockIcon },
    suspended: { label: t('status.suspended'), variant: 'destructive', icon: XIcon },
    paused: { label: t('status.paused'), variant: 'muted', icon: PauseIcon },
    completed: { label: t('status.completed'), variant: 'primary', icon: CheckIcon },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={cn(badgeStyles.statusBadge.gap, className)}>
      <Icon className={badgeStyles.icon} />
      {config.label}
    </Badge>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default Badge;
