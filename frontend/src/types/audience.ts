/**
 * AudienceContext — single audience axis for every gendered/grammatical
 * decision in the UI.
 *
 *   'men'   — masculine neutral plural ("الطلاب", "إدارة الطلاب",
 *             "معلم"). All labels masculine.
 *   'women' — feminine plural ("الطالبات", "إدارة الطالبات", "معلمة").
 *   'mixed' — neutral plural ("الطلبة", "إدارة الطلبة", "معلم/ة"). Used
 *             whenever no concrete gender applies: admin dashboards,
 *             aggregate reports, halaqahs targeting "both", and as the
 *             explicit fallback for any missing/unknown segment.
 *
 * This is the ONLY input the rendering layer needs. Every helper in
 * `lib/uiText.ts` accepts `AudienceContext` (or anything reducible to it
 * via `toAudienceContext`). Nothing else — no booleans, no pronoun
 * strings, no raw segment enums — should drive gendered UI copy.
 */
export type AudienceContext = 'men' | 'women' | 'mixed';

/** Default when a caller has no segment context. Fail-safe neutral. */
export const DEFAULT_AUDIENCE_CONTEXT: AudienceContext = 'mixed';

/**
 * Project any segment-ish value (string from Supabase, enum member,
 * undefined, null, or an already-typed AudienceContext) into a valid
 * AudienceContext literal. Unknown values collapse to 'mixed' — there
 * is no silent fall-through to male or female.
 */
export function toAudienceContext(
  value: unknown,
): AudienceContext {
  if (value === 'men' || value === 'women' || value === 'mixed') return value;
  // Common synonym: halaqah.target_audience = 'both' → mixed audience.
  if (value === 'both') return 'mixed';
  return DEFAULT_AUDIENCE_CONTEXT;
}
