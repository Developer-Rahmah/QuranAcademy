/**
 * Icon Components
 * SVG icon collection
 */
import { cn } from '../../../lib/utils';
import { iconStyles } from './Icon.style';
import type { IconProps, IconWrapperProps } from './Icon.types';

function IconWrapper({ children, className, size = 'md', ...props }: IconWrapperProps) {
  return (
    <svg
      className={cn(iconStyles.sizes[size], className)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      {children}
    </svg>
  );
}

export function BookIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </IconWrapper>
  );
}

export function UserIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </IconWrapper>
  );
}

export function UsersIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </IconWrapper>
  );
}

export function TeacherIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
    </IconWrapper>
  );
}

export function CalendarIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </IconWrapper>
  );
}

export function DocumentIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </IconWrapper>
  );
}

export function SaveIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </IconWrapper>
  );
}

export function RefreshIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </IconWrapper>
  );
}

export function PlusIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </IconWrapper>
  );
}

export function LogoutIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </IconWrapper>
  );
}

export function VideoIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </IconWrapper>
  );
}

export function CopyIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </IconWrapper>
  );
}

export function MailIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </IconWrapper>
  );
}

export function CheckIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </IconWrapper>
  );
}

export function CheckCircleIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </IconWrapper>
  );
}

export function ChatIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </IconWrapper>
  );
}

export function ChartIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </IconWrapper>
  );
}

export function EyeIcon({ className, size }: IconProps) {
  return (
    <IconWrapper className={className} size={size}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </IconWrapper>
  );
}

// ----- Brand icons -----
// Brand glyphs use fill (not stroke) so they get their own wrapper variant.
// Paths are simplified official marks, safe for monochrome tinting via
// `currentColor` so callers can color them with Tailwind text utilities.
function BrandIconWrapper({ children, className, size = 'md', ...props }: IconWrapperProps) {
  return (
    <svg
      className={cn(iconStyles.sizes[size], className)}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function FacebookIcon({ className, size }: IconProps) {
  return (
    <BrandIconWrapper className={className} size={size}>
      <path d="M13.5 21v-7.5h2.5l.5-3h-3V8.5c0-.9.3-1.5 1.6-1.5H17V4.1c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.3-3.8 3.8v2.2H8v3h3V21h2.5z" />
    </BrandIconWrapper>
  );
}

export function InstagramIcon({ className, size }: IconProps) {
  return (
    <BrandIconWrapper className={className} size={size}>
      <path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.5 1 .5.5.8.9 1 1.5.2.4.3 1 .4 2.2.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-1 1.5-.5.5-.9.8-1.5 1-.4.2-1 .3-2.2.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.5-1-.5-.5-.8-.9-1-1.5-.2-.4-.3-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 1-1.5.5-.5.9-.8 1.5-1 .4-.2 1-.3 2.2-.4 1.2-.1 1.6-.1 4.8-.1zm0 2c-3.1 0-3.5 0-4.7.1-1 0-1.5.2-1.9.3-.5.2-.8.4-1.1.7-.3.3-.5.6-.7 1.1-.1.4-.3.9-.3 1.9-.1 1.2-.1 1.6-.1 4.7s0 3.5.1 4.7c0 1 .2 1.5.3 1.9.2.5.4.8.7 1.1.3.3.6.5 1.1.7.4.1.9.3 1.9.3 1.2.1 1.6.1 4.7.1s3.5 0 4.7-.1c1 0 1.5-.2 1.9-.3.5-.2.8-.4 1.1-.7.3-.3.5-.6.7-1.1.1-.4.3-.9.3-1.9.1-1.2.1-1.6.1-4.7s0-3.5-.1-4.7c0-1-.2-1.5-.3-1.9-.2-.5-.4-.8-.7-1.1-.3-.3-.6-.5-1.1-.7-.4-.1-.9-.3-1.9-.3-1.2-.1-1.6-.1-4.7-.1zm0 3.4a4.4 4.4 0 110 8.8 4.4 4.4 0 010-8.8zm0 2a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8zm4.6-2.3a1 1 0 110 2 1 1 0 010-2z" />
    </BrandIconWrapper>
  );
}

export function WhatsappIcon({ className, size }: IconProps) {
  return (
    <BrandIconWrapper className={className} size={size}>
      <path d="M20.5 3.5A10 10 0 003.4 16.9L2 22l5.3-1.4A10 10 0 1020.5 3.5zM12 20.1a8.1 8.1 0 01-4.1-1.1l-.3-.2-3.1.8.8-3-.2-.3A8.1 8.1 0 1120.1 12 8.1 8.1 0 0112 20.1zm4.7-6c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8.9-.2.2-.3.2-.5.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.6-1.5-1.9-.2-.3 0-.4.1-.5l.4-.5c.1-.1.2-.3.3-.4 0-.2 0-.3-.1-.5-.1-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4H8.6c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.3s1 2.7 1.1 2.9c.1.2 1.9 2.9 4.6 4.1 2.3 1 2.7.8 3.2.8.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3z" />
    </BrandIconWrapper>
  );
}

export default {
  BookIcon,
  UserIcon,
  UsersIcon,
  TeacherIcon,
  CalendarIcon,
  DocumentIcon,
  SaveIcon,
  RefreshIcon,
  PlusIcon,
  LogoutIcon,
  VideoIcon,
  CopyIcon,
  MailIcon,
  CheckIcon,
  CheckCircleIcon,
  ChatIcon,
  ChartIcon,
  EyeIcon,
  FacebookIcon,
  InstagramIcon,
  WhatsappIcon,
};
