/**
 * StatCard Component
 * Card displaying a statistic with icon
 */
import { cn } from '../../../lib/utils';
import { Card } from '../Card';
import { ProgressBar } from '../../atoms/ProgressBar';
import { statCardStyles } from './StatCard.style';
import type { StatCardProps, StatCardRowProps } from './StatCard.types';

/**
 * StatCard - Card displaying a statistic with icon
 */
export function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  progress,
  progressLabel,
  variant = 'default',
  className,
}: StatCardProps) {
  return (
    <Card padding="md" className={cn(statCardStyles.variants[variant], className)}>
      <div className={statCardStyles.content.wrapper}>
        <div className={statCardStyles.content.textContent}>
          <p className={statCardStyles.content.title}>{title}</p>
          <p className={statCardStyles.content.value}>{value}</p>
          {subtitle && <p className={statCardStyles.content.subtitle}>{subtitle}</p>}
        </div>
        {Icon && (
          <div className={statCardStyles.icon.wrapper}>
            <Icon className={statCardStyles.icon.icon} />
          </div>
        )}
      </div>

      {progress !== undefined && (
        <div className={statCardStyles.progress.wrapper}>
          {progressLabel && (
            <p className={statCardStyles.progress.label}>{progressLabel}</p>
          )}
          <ProgressBar value={progress} size="sm" />
        </div>
      )}
    </Card>
  );
}

/**
 * StatCardRow - Row of stat cards
 */
export function StatCardRow({ children, className }: StatCardRowProps) {
  return (
    <div className={cn(statCardStyles.row, className)}>
      {children}
    </div>
  );
}

export default StatCard;
