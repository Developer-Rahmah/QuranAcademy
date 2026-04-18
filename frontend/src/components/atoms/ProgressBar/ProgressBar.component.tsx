/**
 * ProgressBar Component
 * Visual progress indicators
 */
import { cn } from '../../../lib/utils';
import { useTranslation } from '../../../locales/i18n';
import { progressBarStyles, circularProgressStyles, getProgressColor } from './ProgressBar.style';
import type { ProgressBarProps, CircularProgressProps } from './ProgressBar.types';

/**
 * ProgressBar - Visual progress indicator
 */
export function ProgressBar({
  value = 0,
  size = 'md',
  showLabel = false,
  className,
}: ProgressBarProps) {
  const { t } = useTranslation();
  const clampedValue = Math.min(Math.max(value, 0), 100);

  return (
    <div className={cn(progressBarStyles.container, className)}>
      {showLabel && (
        <div className={progressBarStyles.label.wrapper}>
          <span className={progressBarStyles.label.text}>{t('common.progress')}</span>
          <span className={progressBarStyles.label.value}>{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div className={cn(progressBarStyles.track.base, progressBarStyles.track.sizes[size])}>
        <div
          className={cn(progressBarStyles.fill.base, getProgressColor(clampedValue))}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}

/**
 * CircularProgress - Circular progress indicator
 */
export function CircularProgress({
  value = 0,
  size = 120,
  strokeWidth = 8,
  showLabel = true,
  className,
}: CircularProgressProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (clampedValue / 100) * circumference;

  return (
    <div className={cn(circularProgressStyles.container, className)}>
      <svg width={size} height={size} className={circularProgressStyles.svg}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={circularProgressStyles.track}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={circularProgressStyles.fill}
        />
      </svg>
      {showLabel && (
        <div className={circularProgressStyles.label.wrapper}>
          <span className={circularProgressStyles.label.value}>{Math.round(clampedValue)}%</span>
        </div>
      )}
    </div>
  );
}

export default ProgressBar;
