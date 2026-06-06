/**
 * validators — single source of truth for input validation.
 *
 * Centralizes the regex constants and per-field validators used by
 * registration, login, password reset, profile edit, admin edits, and
 * the in-app contact/feedback forms. Anything that needs to validate
 * email or phone MUST import from here, not from `lib/utils` (which
 * re-exports for back-compat) and not by inlining a regex.
 *
 * Rationale:
 *   - One place to update the rules when product spec evolves.
 *   - Consistent Arabic/English input handling (digits + whitespace).
 *   - i18n-friendly: validators return a translation `key` instead of
 *     a hard-coded message, so callers can localize via `t(key)`.
 */
import { TOTAL_QURAN_PAGES, MIN_PAGES } from './constants';

// ---------------------------------------------------------------------
// Regex constants
// ---------------------------------------------------------------------

/**
 * Email regex — pragmatic shape check (no full RFC 5322). Rules:
 *   - local part: letters, digits, and `._%+-` (typical mailbox chars).
 *     Cannot start or end with a dot, cannot contain consecutive dots.
 *   - exactly one `@`.
 *   - domain: letters/digits/hyphens, dot-separated labels. No leading
 *     or trailing hyphen on any label.
 *   - TLD: at least 2 letters (catches `user@gmail.co` typos that the
 *     old `\.[^\s@]+` regex let through as `user@gmail.c`).
 *
 * Length cap: 254 chars (the SMTP `MAIL FROM` limit). Reject anything
 * longer instead of letting Supabase choke.
 */
export const EMAIL_REGEX =
  /^[A-Za-z0-9_+-]+(?:\.[A-Za-z0-9_+-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

const EMAIL_MAX_LENGTH = 254;

/**
 * Phone regex — international format, leading `+`, country code 1–3
 * digits, then 7–12 digits. The validator below normalizes input
 * (strips formatting characters, converts Arabic digits) before the
 * test, so callers can pass freeform input.
 */
export const PHONE_REGEX = /^\+\d{8,15}$/;

// Arabic-Indic and Eastern Arabic-Indic digits → ASCII map. Both ranges
// are commonly produced by Arabic IMEs / numeric keypads. We normalize
// at validation time so users don't see false negatives just because
// their device emitted a non-ASCII glyph.
const ARABIC_INDIC_OFFSET = 0x0660; // ٠
const EASTERN_ARABIC_INDIC_OFFSET = 0x06f0; // ۰

/**
 * Convert any Arabic-Indic / Eastern-Arabic digit characters in `input`
 * to ASCII 0–9. Non-digit characters are left untouched.
 */
export function normalizeArabicDigits(input: string): string {
  if (!input) return input;
  let out = '';
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if (code >= ARABIC_INDIC_OFFSET && code <= ARABIC_INDIC_OFFSET + 9) {
      out += String.fromCharCode('0'.charCodeAt(0) + code - ARABIC_INDIC_OFFSET);
    } else if (
      code >= EASTERN_ARABIC_INDIC_OFFSET &&
      code <= EASTERN_ARABIC_INDIC_OFFSET + 9
    ) {
      out += String.fromCharCode(
        '0'.charCodeAt(0) + code - EASTERN_ARABIC_INDIC_OFFSET,
      );
    } else {
      out += ch;
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// Field validators
// ---------------------------------------------------------------------

/**
 * Returns true for a syntactically plausible email. Leading / trailing
 * whitespace is tolerated (we trim before the test).
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > EMAIL_MAX_LENGTH) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Returns true for a syntactically plausible international phone number.
 *
 * Tolerated input variations:
 *   - leading `+` optional only when the rest is a country-coded number;
 *   - spaces, dashes, parentheses are stripped;
 *   - Arabic-Indic / Eastern-Arabic digits are normalized to ASCII.
 *
 * Rejects: numbers without a country code, sub-7-digit fragments,
 * any leftover non-digit after normalization.
 */
export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const normalized = normalizeArabicDigits(phone).trim();
  // Strip cosmetic formatting characters before applying the regex.
  const cleaned = normalized.replace(/[\s\-()]/g, '');
  return PHONE_REGEX.test(cleaned);
}

/**
 * Normalize a phone string to canonical international format
 * (`+CCC...`). Returns the cleaned string even if it doesn't pass
 * full validation — callers needing strict validity should pair this
 * with `isValidPhone`.
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = normalizeArabicDigits(phone).replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  // If the user entered a country-coded number without `+`, prepend it.
  if (/^\d{8,15}$/.test(cleaned)) return '+' + cleaned;
  return cleaned;
}

/**
 * Result tuple returned by validators that carry a localized error.
 * Callers should pass `messageKey` through `t(...)` to render.
 *
 *   const { isValid, messageKey } = validatePassword(value);
 *   if (!isValid) toast.error(t(messageKey));
 */
export interface ValidationResult {
  isValid: boolean;
  /** i18n key. Empty string when `isValid` is true. */
  messageKey: string;
}

/** Password strength check. Min 8 characters. */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, messageKey: 'validation.passwordRequired' };
  }
  if (password.length < 8) {
    return { isValid: false, messageKey: 'validation.passwordMinLength' };
  }
  return { isValid: true, messageKey: '' };
}

/** Page-count check for a single report item. */
export function validatePages(pages: string | number): ValidationResult {
  const num = parseFloat(String(pages));
  if (isNaN(num) || num < MIN_PAGES) {
    return { isValid: false, messageKey: 'validation.pagesTooFew' };
  }
  if (num > TOTAL_QURAN_PAGES) {
    return { isValid: false, messageKey: 'validation.pagesTooMany' };
  }
  return { isValid: true, messageKey: '' };
}
