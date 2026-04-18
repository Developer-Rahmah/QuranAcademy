/**
 * ProgressBar Component Types
 */

export type ProgressBarSize = 'sm' | 'md' | 'lg';

export interface ProgressBarProps {
  value?: number;
  size?: ProgressBarSize;
  showLabel?: boolean;
  className?: string;
}

export interface CircularProgressProps {
  value?: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  className?: string;
}
