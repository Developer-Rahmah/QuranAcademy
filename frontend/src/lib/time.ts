/**
 * time — centralized scheduling primitives for the academy app.
 *
 * Two product rules live here:
 *
 *   1. Halaqah sessions are TWO HOURS long. Anywhere a slot start is
 *      shown, the corresponding end is computed via
 *      `SESSION_DURATION_HOURS` — never hardcoded.
 *
 *   2. Times are presented to non-technical Arabic users in 12-hour
 *      format with localized AM/PM markers ("صباحًا" / "مساءً").
 *      Storage stays on a 24-hour clock string id so backend logic
 *      and DB-stored profile availability rows are untouched.
 *
 * Slot id contract (unchanged by this module — see `TIME_SLOTS` in
 * `lib/constants.ts`):
 *
 *   "HH-HH"   ←   start hour (00..23) and end hour (00..24, where
 *                 "00" represents the next-day midnight wrap).
 *
 *   Examples: "09-11" (09:00 → 11:00), "22-00" (22:00 → 24:00 wrap).
 *
 * Legacy compatibility:
 *
 *   Profiles created before the move from 1-hour to 2-hour slots
 *   stored single-hour ids like "09-10". The parser + formatter here
 *   accept any `HH-HH` id, regardless of duration — so the
 *   AdminUserDetail availability list keeps rendering legacy data
 *   unchanged. The selector only emits new 2-hour ids going forward,
 *   so the DB self-heals as users re-save their availability.
 */

/**
 * Halaqah session length, in hours. Single source of truth for slot
 * duration anywhere in the app — `TIME_SLOTS`, slot end-time
 * computation, schedule generators, overlap validation. NEVER inline
 * `2` directly in scheduling code; import this instead.
 */
export const SESSION_DURATION_HOURS = 2;

/**
 * Supported display languages for time formatters. Mirrors the
 * project's `Language` union (`'ar' | 'en'`). Kept narrow on purpose
 * so a typo at a call site is a TS error.
 */
export type TimeLanguage = 'ar' | 'en';

/**
 * Parse a slot id into its `[startHour, endHour]` 24h pair.
 *
 * Returns `null` when the input does not match the `HH-HH` shape so
 * callers can fall through to a verbatim render (defensive against
 * malformed legacy data).
 *
 * `endHour` may equal 24 — that's the wrap-around case for "22-00"
 * (22:00 → 24:00). Formatter handles it as midnight on the next day.
 */
export function parseSlotId(
  id: string,
): { startHour: number; endHour: number } | null {
  const match = id.match(/^(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const startHour = parseInt(match[1], 10);
  let endHour = parseInt(match[2], 10);
  if (Number.isNaN(startHour) || Number.isNaN(endHour)) return null;
  // "22-00" wrap → represent end as 24 so duration math works.
  if (endHour === 0 && startHour !== 0) endHour = 24;
  if (startHour < 0 || startHour > 23) return null;
  if (endHour < 0 || endHour > 24) return null;
  return { startHour, endHour };
}

/**
 * Format a single 24h hour value (0..24) as a 12h string with the
 * appropriate AM/PM marker for the active language.
 *
 *   formatHour12(0,  'ar') → "12:00 صباحًا"
 *   formatHour12(9,  'ar') → "9:00 صباحًا"
 *   formatHour12(13, 'ar') → "1:00 مساءً"
 *   formatHour12(24, 'ar') → "12:00 صباحًا"   (next-day midnight wrap)
 *
 * The hours are not zero-padded so the Arabic version reads naturally
 * ("9:00 صباحًا" rather than "09:00 صباحًا" which a non-technical
 * Arabic reader is more likely to misread as a date).
 */
export function formatHour12(hour: number, language: TimeLanguage): string {
  // Normalize the wrap-around 24 → 0 so labels read "12:00".
  const h = ((hour % 24) + 24) % 24;
  const period12 = h % 12 === 0 ? 12 : h % 12;
  const isAM = h < 12;
  if (language === 'ar') {
    return `${period12}:00 ${isAM ? 'صباحًا' : 'مساءً'}`;
  }
  return `${period12}:00 ${isAM ? 'AM' : 'PM'}`;
}

/**
 * Format a slot id as a localized "start — end" 12h range.
 *
 *   formatSlotRange("09-11", 'ar') → "9:00 صباحًا – 11:00 صباحًا"
 *   formatSlotRange("13-15", 'en') → "1:00 PM – 3:00 PM"
 *   formatSlotRange("garbage", 'ar') → "garbage"   (verbatim fallback)
 *
 * Non-parseable input renders as-is rather than throwing — call sites
 * loop over user-supplied data we don't fully control.
 */
export function formatSlotRange(id: string, language: TimeLanguage): string {
  const parsed = parseSlotId(id);
  if (!parsed) return id;
  const { startHour, endHour } = parsed;
  const start = formatHour12(startHour, language);
  const end = formatHour12(endHour, language);
  // U+2013 EN DASH — visually balanced for both LTR and RTL contexts.
  return `${start} – ${end}`;
}

/**
 * Build a slot id for a given start hour using the canonical session
 * duration. Use this anywhere a NEW slot id needs to be created so
 * the duration stays consistent across the codebase.
 *
 *   makeSlotId(8)  → "08-10"
 *   makeSlotId(22) → "22-00"   (wrap-around midnight)
 */
export function makeSlotId(startHour: number): string {
  const start = String(startHour).padStart(2, '0');
  const end = String((startHour + SESSION_DURATION_HOURS) % 24).padStart(2, '0');
  return `${start}-${end}`;
}
