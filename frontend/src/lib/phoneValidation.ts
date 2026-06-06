/**
 * phoneValidation — per-country phone number sanity checks.
 *
 * The registration form already strips formatting characters down to
 * digits via `PhoneField.normalizeLocal`, so the input we receive here
 * is "0501234567" / "501234567" / "966501234567" etc. — never the +/−
 * spaces. This module decides whether that digit string is a plausible
 * mobile number for the country the user picked in the country dropdown.
 *
 * Why per-country rules and not libphonenumber:
 *   - Adding libphonenumber-js is ~120 KB of bundle for a single form.
 *   - The mistake we're catching is overwhelmingly "user left the default
 *     country (SA) and typed a JO/EG number", which a length+prefix
 *     check per country already catches reliably.
 *   - The COUNTRIES list is hand-curated; rules below mirror that list.
 *
 * Rule shape per country:
 *   - `length` — accepted digit count(s) for the LOCAL portion, after
 *     the trunk prefix (national '0') is stripped.
 *   - `prefixes` — first-digit set for valid mobile numbers. Omitted
 *     when mobile shares prefix space with landline in a way that would
 *     produce false negatives.
 *   - `trunkPrefix` — leading digit that users habitually include
 *     (national format) but isn't part of the E.164 form. '0' for most
 *     of the world; '8' for Russia/Kazakhstan; absent for the Gulf
 *     states where numbers are dialled bare.
 *
 * If a country has no entry, we fall back to a generic 7–15 digit check
 * (matching the global E.164 range).
 */
import { findCountryByIso } from './countries';
import {
  normalizeArabicDigits,
  type ValidationResult,
} from './validators';

export interface PhoneRule {
  /** Accepted local-part lengths (after trunk prefix is stripped). */
  length: number | readonly number[];
  /** Allowed first digits of the local part. e.g. ['5'] for SA mobile. */
  prefixes?: readonly string[];
  /** Trunk prefix users habitually include. Stripped before checking. */
  trunkPrefix?: string;
}

/**
 * Per-country mobile number rules. Mirrors `lib/countries.ts`.
 *
 * The values here describe MOBILE numbers because the form is used by
 * students/teachers signing up to be contacted via WhatsApp — landline
 * numbers would never reach them. If a country's landline + mobile
 * overlap in length and we'd reject too many users, the prefix list is
 * widened or omitted entirely (length-only check).
 */
export const PHONE_RULES: Readonly<Record<string, PhoneRule>> = {
  // MENA / Gulf — trunk prefix '0' commonly typed by users.
  SA: { length: 9,  prefixes: ['5'],                    trunkPrefix: '0' },
  AE: { length: 9,  prefixes: ['5'],                    trunkPrefix: '0' },
  KW: { length: 8,  prefixes: ['5', '6', '9'] },
  QA: { length: 8,  prefixes: ['3', '5', '6', '7'] },
  BH: { length: 8,  prefixes: ['3', '6'] },
  OM: { length: 8,  prefixes: ['7', '9'] },
  YE: { length: 9,  prefixes: ['7'],                    trunkPrefix: '0' },
  EG: { length: 10, prefixes: ['1'],                    trunkPrefix: '0' },
  SD: { length: 9,  prefixes: ['1', '9'],               trunkPrefix: '0' },
  LY: { length: 9,  prefixes: ['9'],                    trunkPrefix: '0' },
  TN: { length: 8,  prefixes: ['2', '3', '4', '5', '7', '9'] },
  DZ: { length: 9,  prefixes: ['5', '6', '7'],          trunkPrefix: '0' },
  MA: { length: 9,  prefixes: ['6', '7'],               trunkPrefix: '0' },
  MR: { length: 8,  prefixes: ['2', '3', '4'] },
  JO: { length: 9,  prefixes: ['7'],                    trunkPrefix: '0' },
  PS: { length: 9,  prefixes: ['5'],                    trunkPrefix: '0' },
  LB: { length: [7, 8], prefixes: ['3', '7', '8'],      trunkPrefix: '0' },
  SY: { length: 9,  prefixes: ['9'],                    trunkPrefix: '0' },
  IQ: { length: 10, prefixes: ['7'],                    trunkPrefix: '0' },

  // Wider region
  TR: { length: 10, prefixes: ['5'],                    trunkPrefix: '0' },
  IR: { length: 10, prefixes: ['9'],                    trunkPrefix: '0' },
  PK: { length: 10, prefixes: ['3'],                    trunkPrefix: '0' },
  IN: { length: 10, prefixes: ['6', '7', '8', '9'] },
  BD: { length: 10, prefixes: ['1'],                    trunkPrefix: '0' },
  ID: { length: [9, 10, 11, 12], prefixes: ['8'],       trunkPrefix: '0' },
  MY: { length: [9, 10], prefixes: ['1'],               trunkPrefix: '0' },
  SG: { length: 8,  prefixes: ['8', '9'] },
  BN: { length: 7,  prefixes: ['7', '8'] },

  // Africa
  NG: { length: 10, prefixes: ['7', '8', '9'],          trunkPrefix: '0' },
  SN: { length: 9,  prefixes: ['7'],                    trunkPrefix: '0' },
  SO: { length: [8, 9], prefixes: ['6', '7', '9'],      trunkPrefix: '0' },
  DJ: { length: 8,                                       trunkPrefix: '0' },
  KM: { length: 7 },
  ZA: { length: 9,  prefixes: ['6', '7', '8'],          trunkPrefix: '0' },
  KE: { length: 9,  prefixes: ['7'],                    trunkPrefix: '0' },
  ET: { length: 9,  prefixes: ['9'],                    trunkPrefix: '0' },
  TZ: { length: 9,  prefixes: ['6', '7'],               trunkPrefix: '0' },

  // Europe
  GB: { length: 10, prefixes: ['7'],                    trunkPrefix: '0' },
  IE: { length: 9,  prefixes: ['8'],                    trunkPrefix: '0' },
  FR: { length: 9,  prefixes: ['6', '7'],               trunkPrefix: '0' },
  DE: { length: [10, 11], prefixes: ['1'],              trunkPrefix: '0' },
  NL: { length: 9,  prefixes: ['6'],                    trunkPrefix: '0' },
  BE: { length: 9,  prefixes: ['4'],                    trunkPrefix: '0' },
  ES: { length: 9,  prefixes: ['6', '7'] },
  IT: { length: [9, 10], prefixes: ['3'] },
  SE: { length: 9,  prefixes: ['7'],                    trunkPrefix: '0' },
  NO: { length: 8,  prefixes: ['4', '9'] },
  DK: { length: 8 },
  FI: { length: [9, 10], prefixes: ['4', '5'],          trunkPrefix: '0' },
  CH: { length: 9,  prefixes: ['7'],                    trunkPrefix: '0' },
  AT: { length: [10, 11, 12, 13], prefixes: ['6'],      trunkPrefix: '0' },
  PL: { length: 9,  prefixes: ['4', '5', '6', '7', '8'] },
  RO: { length: 9,  prefixes: ['7'],                    trunkPrefix: '0' },
  GR: { length: 10, prefixes: ['6'] },
  RU: { length: 10, prefixes: ['9'],                    trunkPrefix: '8' },
  UA: { length: 9,  prefixes: ['5', '6', '7', '9'],     trunkPrefix: '0' },
  AZ: { length: 9,  prefixes: ['4', '5', '7'],          trunkPrefix: '0' },
  KZ: { length: 10, prefixes: ['7'],                    trunkPrefix: '8' },
  UZ: { length: 9,  prefixes: ['7', '8', '9'],          trunkPrefix: '0' },
  AF: { length: 9,  prefixes: ['7'],                    trunkPrefix: '0' },

  // Americas & APAC
  US: { length: 10 },
  CA: { length: 10 },
  MX: { length: 10 },
  BR: { length: [10, 11], prefixes: ['9'] },
  AR: { length: 10 },
  CL: { length: 9,  prefixes: ['9'] },
  AU: { length: 9,  prefixes: ['4'],                    trunkPrefix: '0' },
  NZ: { length: [9, 10] },
  CN: { length: 11, prefixes: ['1'] },
  JP: { length: 10, prefixes: ['7', '8', '9'],          trunkPrefix: '0' },
  KR: { length: [10, 11], prefixes: ['1'],              trunkPrefix: '0' },
  PH: { length: 10, prefixes: ['9'],                    trunkPrefix: '0' },
  TH: { length: 9,  prefixes: ['6', '8', '9'],          trunkPrefix: '0' },
  VN: { length: [9, 10], prefixes: ['3', '5', '7', '8', '9'], trunkPrefix: '0' },
};

/** Generic fallback when a country has no specific rule. */
const FALLBACK_RULE: PhoneRule = { length: [7, 8, 9, 10, 11, 12, 13, 14, 15] };

/**
 * Strip cosmetic content and convert Arabic digits to ASCII. Returns
 * only the digits — empty when input had no digits at all.
 */
function digitsOnly(input: string): string {
  if (!input) return '';
  const ascii = normalizeArabicDigits(input);
  return ascii.replace(/\D/g, '');
}

function lengthMatches(rule: PhoneRule, n: number): boolean {
  if (typeof rule.length === 'number') return rule.length === n;
  return rule.length.includes(n);
}

/**
 * Normalize a user-entered local number against a country's rule:
 *   1. Convert Arabic digits to ASCII, strip everything non-digit.
 *   2. If the input starts with the country's dial code, drop it
 *      (user typed the country code into the local field).
 *   3. If the input then starts with the country's trunk prefix,
 *      drop it (national-format leading 0 etc.).
 *
 * Exported so submit handlers can also normalize before storing.
 */
export function normalizeLocalForCountry(
  iso2: string,
  local: string,
): string {
  const country = findCountryByIso(iso2);
  let digits = digitsOnly(local);
  if (country && digits.startsWith(country.dial)) {
    digits = digits.slice(country.dial.length);
  }
  const rule = PHONE_RULES[iso2] ?? FALLBACK_RULE;
  if (rule.trunkPrefix && digits.startsWith(rule.trunkPrefix)) {
    digits = digits.slice(rule.trunkPrefix.length);
  }
  return digits;
}

/**
 * Validate a `(iso2, local)` pair against the country's mobile rule.
 * Returns one of three i18n keys describing the failure mode so the UI
 * can render a precise error message.
 */
export function validateLocalPhone(
  iso2: string,
  local: string,
): ValidationResult {
  if (!local || !digitsOnly(local)) {
    return { isValid: false, messageKey: 'validation.phoneRequired' };
  }

  const normalized = normalizeLocalForCountry(iso2, local);
  const rule = PHONE_RULES[iso2] ?? FALLBACK_RULE;

  if (!lengthMatches(rule, normalized.length)) {
    return { isValid: false, messageKey: 'validation.phoneInvalidForCountry' };
  }

  if (rule.prefixes && !rule.prefixes.includes(normalized.charAt(0))) {
    return { isValid: false, messageKey: 'validation.phoneInvalidForCountry' };
  }

  return { isValid: true, messageKey: '' };
}
