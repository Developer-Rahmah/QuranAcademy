import { TOTAL_QURAN_PAGES } from './constants';
import type { Profile } from '../types';

// Re-export validators from the dedicated module so existing
// `import { isValidEmail, ... } from '../lib/utils'` call-sites keep
// compiling. New code should import from `lib/validators` directly.
export {
  EMAIL_REGEX,
  PHONE_REGEX,
  normalizeArabicDigits,
  isValidEmail,
  isValidPhone,
  formatPhone,
  validatePassword,
  validatePages,
} from './validators';
export type { ValidationResult } from './validators';

/**
 * Combines class names, filtering out falsy values
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Calculates progress percentage based on memorized pages
 */
export function calculateProgress(memorizedPages: number): number {
  if (!memorizedPages || memorizedPages < 0) return 0;
  const progress = (memorizedPages / TOTAL_QURAN_PAGES) * 100;
  return Math.min(Math.round(progress * 100) / 100, 100);
}

/**
 * Formats a number with Arabic numerals
 */
export function formatArabicNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '';
  return num.toLocaleString('ar-SA');
}

/**
 * Formats a date in Arabic format
 */
export function formatArabicDate(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formats a Date instance as YYYY-MM-DD using the LOCAL timezone.
 *
 * `toISOString()` is intentionally NOT used here — it serializes to UTC,
 * so a Date constructed at 11pm in Riyadh (UTC+3) would round-trip as
 * "tomorrow" when sliced as a date-only string. For date-only fields
 * (`reports.report_date`, `<input type="date">` values) we must read
 * local components so the surfaced day matches the user's calendar day.
 *
 * Anything date-only that is server-stored as a string ("2025-05-09")
 * MUST go through this helper. Datetimes that are stored as UTC
 * timestamps (`created_at` etc.) keep using ISO/UTC.
 */
export function formatDateISO(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Today's date as a YYYY-MM-DD string in the user's LOCAL timezone.
 *
 * The single canonical entry-point for "what is today" anywhere a
 * date-only field is involved (report defaults, input max attributes,
 * day-bucket comparisons). Constructing dates inline with
 * `new Date()` and then offsetting / `toISOString()`-ing is the bug
 * source we're closing — past attempts at fixing the off-by-one used
 * `setDate(getDate() + 1)` to mask a UTC shift in `formatDateISO`,
 * which then started rendering as TOMORROW once `formatDateISO` was
 * corrected. Funnel everything through this helper instead.
 */
export function getTodayLocalDate(): string {
  return formatDateISO(new Date());
}

/**
 * Gets the full name from profile data
 */
export function getFullName(profile: Partial<Profile> | null | undefined): string {
  if (!profile) return '';
  const { first_name, second_name, third_name } = profile;
  return [first_name, second_name, third_name].filter(Boolean).join(' ');
}

/**
 * Gets display name (first + second name)
 */
export function getDisplayName(profile: Partial<Profile> | null | undefined): string {
  if (!profile) return '';
  const { first_name, second_name } = profile;
  return [first_name, second_name].filter(Boolean).join(' ');
}

/**
 * Builds a `https://wa.me/<digits>` URL.
 *
 * Strips a leading `+`, spaces, dashes, and parentheses. Returns null
 * for empty / invalid input so callers can hide the button when there
 * is no number to call.
 *
 * Optional `text` is URL-encoded and appended as ?text=.
 */
export function buildWhatsAppLink(
  phone: string | null | undefined,
  text?: string,
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 6) return null;
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Truncates text to specified length
 */
export function truncate(text: string | null | undefined, maxLength: number = 50): string {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength) + '...';
}

/**
 * Generates a random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Copies text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}

/**
 * Gets error message from Supabase error
 */
export function getErrorMessage(error: Error | null | undefined): string {
  if (!error) return '';

  const errorMessages: Record<string, string> = {
    'Invalid login credentials': 'بيانات تسجيل الدخول غير صحيحة',
    'Email not confirmed': 'البريد الإلكتروني غير مؤكد',
    'User already registered': 'البريد الإلكتروني مسجل مسبقاً',
    'Password should be at least 6 characters': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    'Unable to validate email address': 'البريد الإلكتروني غير صالح',
  };

  return errorMessages[error.message] || error.message || 'حدث خطأ غير متوقع';
}

/**
 * Sorts items by date (newest first)
 */
export function sortByDate<T extends Record<string, unknown>>(
  items: T[],
  dateKey: keyof T = 'created_at' as keyof T
): T[] {
  return [...items].sort((a, b) => {
    const dateA = new Date(a[dateKey] as string);
    const dateB = new Date(b[dateKey] as string);
    return dateB.getTime() - dateA.getTime();
  });
}

/**
 * Groups items by a key
 */
export function groupBy<T extends Record<string, unknown>>(
  items: T[],
  key: keyof T
): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const groupKey = String(item[key]);
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
