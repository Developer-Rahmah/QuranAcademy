import { TOTAL_QURAN_PAGES } from './constants';
import type { Profile } from '../types';

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
 * Formats a date as YYYY-MM-DD
 */
export function formatDateISO(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
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
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates phone number format (international format with country code)
 * Accepts formats like: +966501234567, +201234567890, +1234567890
 */
export function isValidPhone(phone: string): boolean {
  // Remove spaces and dashes
  const cleaned = phone.replace(/[\s\-()]/g, '');
  // Must start with + followed by country code (1-3 digits) and phone number (7-12 digits)
  const phoneRegex = /^\+\d{1,3}\d{7,12}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Formats phone number to standard format
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';
  // Remove spaces and dashes
  const cleaned = phone.replace(/[\s\-()]/g, '');
  // If already has +, return as is
  if (cleaned.startsWith('+')) return cleaned;
  // If starts with country code without +, add +
  if (/^\d{1,3}\d{7,12}$/.test(cleaned)) return '+' + cleaned;
  return cleaned;
}

/**
 * Validates password strength
 */
export function validatePassword(password: string): { isValid: boolean; message: string } {
  if (!password) {
    return { isValid: false, message: 'كلمة المرور مطلوبة' };
  }
  if (password.length < 8) {
    return { isValid: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
  }
  return { isValid: true, message: '' };
}

/**
 * Validates page count for reports
 */
export function validatePages(pages: string | number): { isValid: boolean; message: string } {
  const num = parseFloat(String(pages));
  if (isNaN(num) || num < 0.25) {
    return { isValid: false, message: 'الحد الأدنى: ربع صفحة (0.25)' };
  }
  if (num > TOTAL_QURAN_PAGES) {
    return { isValid: false, message: `الحد الأقصى: ${TOTAL_QURAN_PAGES} صفحة` };
  }
  return { isValid: true, message: '' };
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
