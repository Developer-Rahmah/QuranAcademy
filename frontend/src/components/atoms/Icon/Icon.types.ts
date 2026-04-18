/**
 * Icon Component Types
 */
import { SVGProps, ReactNode } from 'react';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

export interface IconProps extends SVGProps<SVGSVGElement> {
  className?: string;
  size?: IconSize;
}

export interface IconWrapperProps extends IconProps {
  children: ReactNode;
}
