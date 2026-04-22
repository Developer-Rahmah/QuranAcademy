/**
 * Canonical enums for gendered / role-aware UI logic.
 *
 * `Segment` is the SINGLE source of truth for gender/audience segmentation
 * across the app. `Role` is the orthogonal dimension (student/teacher/admin).
 *
 *   MEN   — male halaqahs, male students/teachers. Masculine grammar.
 *   WOMEN — female halaqahs, female students/teachers. Feminine grammar.
 *   MIXED — segment-agnostic surface (e.g. admin dashboards, aggregate
 *           reports, halaqahs with `target_audience = 'both'`). Renders
 *           NEUTRAL copy. This is what consumers should pick when no
 *           gender context exists, rather than falling back to either
 *           male or female silently.
 *
 * A TypeScript string enum compares equal to its string literal, so
 * `profile.segment === Segment.MEN` works even when the column comes
 * back as the raw `'men'` string from Supabase.
 */

export enum Segment {
  MEN = 'men',
  WOMEN = 'women',
  MIXED = 'mixed',
}

export enum Role {
  STUDENT = 'student',
  TEACHER = 'teacher',
  ADMIN = 'admin',
}

/** String-literal type mirroring `Segment`, for APIs that prefer unions. */
export type SegmentValue = `${Segment}`;
/** String-literal type mirroring `Role`. */
export type RoleValue = `${Role}`;
