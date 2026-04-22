/**
 * Central enums for the segmentation/gender system.
 *
 * These are the single source of truth for "men/women/admin" and the
 * audience taxonomy. Existing string-literal types (`UserSegment`,
 * `PreferredAudience`) are kept as aliases so old imports keep compiling
 * during the migration — but the enum is what the rule engine and any
 * new code should consume.
 *
 * Why an enum on top of string literals?
 *   - Stable name → value mapping you can switch over.
 *   - Compile-time safety: `UserSegment.MEN` can't be a typo for `'mens'`.
 *   - One canonical place to extend (e.g. add NON_ARABIC) without touching
 *     scattered union types.
 *
 * NOTE: TypeScript string-enum members compare equal to their string
 * value, so `profile.segment === UserSegment.MEN` works even when the
 * `segment` column comes back as the raw `'men'` string from Supabase.
 */

export enum UserSegment {
  MEN = 'men',
  WOMEN = 'women',
  /** Synthetic segment used by the rule engine to represent an admin user.
   *  Stored separately from the DB segment column — admins set their real
   *  gender there, but the UI bypasses gendered labels for them. */
  ADMIN = 'admin',
}

export enum AudienceType {
  MEN = 'men',
  WOMEN = 'women',
  CHILDREN = 'children',
  BOTH = 'both',
}

/** Concrete halaqah segments (admin is excluded; halaqahs are gendered). */
export type HalaqahSegment = UserSegment.MEN | UserSegment.WOMEN;
