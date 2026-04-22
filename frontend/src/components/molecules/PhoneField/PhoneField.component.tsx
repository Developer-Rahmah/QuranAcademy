/**
 * PhoneField — country-flag selector + local phone number input.
 *
 * Emits a single callback with both pieces so the parent form can decide
 * what to store:
 *   - `country` (ISO-2, e.g. "SA") — written to the profile's existing
 *     `country` column for backward compatibility.
 *   - `phone` (E.164, e.g. "+966501234567") — the concatenated value that
 *     gets written to the profile's `phone` column.
 *
 * The parent keeps track of both fields independently; this component just
 * drives the editing UX.
 */
import { useMemo } from 'react';
import { Label, ErrorText } from '../../atoms/Text';
import { COUNTRIES, findCountryByIso, DEFAULT_COUNTRY_ISO } from '../../../lib/countries';

export interface PhoneFieldValue {
  /** ISO-3166 alpha-2 country code. */
  country: string;
  /** Local phone number digits (no dial code, no '+'). */
  local: string;
}

interface PhoneFieldProps {
  label?: string;
  name?: string;
  required?: boolean;
  value: PhoneFieldValue;
  onChange: (value: PhoneFieldValue) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Strip any non-digit characters a user might paste (spaces, dashes, '+').
 * Dial code is stored separately, so leading '+' or a repeated country code
 * here would double-up when we concatenate at submit time.
 */
function normalizeLocal(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Compose the final E.164-style phone string from a PhoneFieldValue.
 * Exported so form submit handlers use the same logic as the component.
 */
export function toE164({ country, local }: PhoneFieldValue): string {
  const c = findCountryByIso(country);
  if (!c) return local ? `+${local}` : '';
  return local ? `+${c.dial}${local}` : '';
}

/**
 * Split a stored E.164 phone back into PhoneFieldValue. Best-effort —
 * matches against the COUNTRIES table by longest dial prefix. If nothing
 * matches, falls back to DEFAULT_COUNTRY_ISO and treats the rest as local.
 */
export function fromE164(phone: string | null | undefined): PhoneFieldValue {
  if (!phone) return { country: DEFAULT_COUNTRY_ISO, local: '' };
  const digits = phone.replace(/\D/g, '');
  // Longest dial match wins (e.g. '1' vs nothing; '966' vs '96').
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (digits.startsWith(c.dial)) {
      return { country: c.iso2, local: digits.slice(c.dial.length) };
    }
  }
  return { country: DEFAULT_COUNTRY_ISO, local: digits };
}

export function PhoneField({
  label,
  name,
  required,
  value,
  onChange,
  error,
  placeholder,
  disabled,
}: PhoneFieldProps) {
  const selected = useMemo(
    () => findCountryByIso(value.country) ?? findCountryByIso(DEFAULT_COUNTRY_ISO)!,
    [value.country],
  );
  const hasError = Boolean(error);

  return (
    <div className="space-y-1">
      {label && (
        <Label htmlFor={name} required={required}>
          {label}
        </Label>
      )}
      <div
        className={`flex w-full max-w-full items-stretch rounded-lg border transition-colors ${
          hasError
            ? 'border-destructive focus-within:ring-destructive/20'
            : 'border-border focus-within:ring-primary/20 focus-within:border-primary'
        } bg-white focus-within:ring-2 overflow-hidden`}
      >
        {/*
          Country picker: a fixed-width visible chip (flag + dial code) sits
          on top of an invisible native <select>. The select handles the
          actual interaction (and OS-native dropdown), but its collapsed
          text — which would otherwise expand to the full country name and
          push the input out of the row — is never rendered.
        */}
        <div className="relative flex-none w-24 min-w-0">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1 px-2 text-sm text-foreground select-none"
          >
            <span className="text-base leading-none">{selected.flag}</span>
            <span className="font-medium">+{selected.dial}</span>
          </div>
          <select
            aria-label="country"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            value={selected.iso2}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, country: e.target.value })}
          >
            {COUNTRIES.map((c) => (
              <option key={c.iso2} value={c.iso2}>
                {c.flag} {c.name} (+{c.dial})
              </option>
            ))}
          </select>
        </div>

        <span className="flex-none self-stretch border-s border-border/60" aria-hidden="true" />

        <input
          id={name}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 min-w-0 w-full bg-transparent px-3 py-3 text-foreground placeholder:text-muted outline-none"
          value={value.local}
          onChange={(e) => onChange({ ...value, local: normalizeLocal(e.target.value) })}
        />
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

export default PhoneField;
