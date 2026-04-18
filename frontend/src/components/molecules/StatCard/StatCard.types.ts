/**
 * StatCard Component Types
 */
import { ReactNode, ComponentType } from 'react';

export type StatCardVariant = 'default' | 'primary' | 'success';

export interface IconProps {
  className?: string;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ComponentType<IconProps>;
  subtitle?: string;
  progress?: number;
  progressLabel?: string;
  variant?: StatCardVariant;
  className?: string;
}

export interface StatCardRowProps {
  children: ReactNode;
  className?: string;
}
