/**
 * Badge Component Types
 */
import { HTMLAttributes, ReactNode, FC } from 'react';

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' | 'muted';
export type BadgeSize = 'sm' | 'md';
export type StatusType = 'active' | 'pending' | 'suspended' | 'paused' | 'completed';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
}

export interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export interface StatusConfig {
  label: string;
  variant: BadgeVariant;
  icon: FC<{ className?: string }>;
}
