/**
 * Segment-aware helpers — keep the gender/segment → role-label / audience /
 * student-type mapping in one place so registration forms, admin lists,
 * and dashboards can't drift.
 *
 * IMPORTANT — DB vs UI split:
 *   The DB enums are fixed (no migrations in this task):
 *     - student_type       = 'woman' | 'child'
 *     - preferred_audience = 'children' | 'women' | 'both'
 *   We now want the UI to expose 'man' and 'men' tokens. Those are
 *   UI-only: the form captures them in local state, and at submit time
 *   `submitStudentType` / `submitPreferredAudience` coerce them back to
 *   DB-valid values. The gender signal itself is carried authoritatively
 *   by `profiles.segment`, so no information is lost.
 *
 *   UI-only types live in this file so nobody outside registration has to
 *   import or handle them.
 *
 * Rules (per product spec):
 *
 *   segment = 'men'
 *     → student_type UI options: ['man', 'child']
 *     → audience UI options    : ['men', 'children', 'both']
 *
 *   segment = 'women'
 *     → student_type UI options: ['woman', 'child']
 *     → audience UI options    : ['women', 'children', 'both']
 *
 *   segment = 'children'
 *     → student_type UI options: ['child']
 *     → audience UI options    : ['children', 'women', 'both']
 *
 * Arabic/Non-Arabic speakers is NOT a segment anymore — it's a separate
 * `language_type` column ('arabic_speaker' | 'non_arabic_speaker')
 * captured via its own radio group in the registration form.
 */
import type { UserRole, UserSegment, PreferredAudience, StudentType } from '../types';

/**
 * UI-only superset of StudentType so forms can render "man" as an option.
 * Persisted value is coerced via `submitStudentType` below.
 */
export type StudentTypeUI = StudentType | 'man';

/**
 * UI-only superset of PreferredAudience so forms can render "men" as an
 * option. Persisted value is coerced via `submitPreferredAudience` below.
 */
export type PreferredAudienceUI = PreferredAudience | 'men';

/**
 * i18n key for the role label, gendered by segment.
 * Admin is NEVER returned as student/teacher — it gets its own label key.
 */
export function roleLabelKey(role: UserRole, segment?: UserSegment): string {
  if (role === 'admin') return 'auth.admin';
  if (segment === 'men') return role === 'teacher' ? 'auth.teacherMale' : 'auth.studentMale';
  if (segment === 'women') return role === 'teacher' ? 'auth.teacherFemale' : 'auth.studentFemale';
  return role === 'teacher' ? 'auth.teacher' : 'auth.student';
}

/** i18n key for the registration page title, gendered by segment. */
export function registrationTitleKey(role: UserRole, segment?: UserSegment): string {
  const isTeacher = role === 'teacher';
  if (segment === 'men') {
    return isTeacher ? 'registration.teacherMaleTitle' : 'registration.studentMaleTitle';
  }
  if (segment === 'women') {
    return isTeacher ? 'registration.teacherFemaleTitle' : 'registration.studentFemaleTitle';
  }
  return isTeacher ? 'registration.teacherTitle' : 'registration.studentTitle';
}

// ---------------- student_type ----------------

export function studentTypeOptionsForSegment(segment: UserSegment): StudentTypeUI[] {
  if (segment === 'men') return ['man', 'child'];
  if (segment === 'women') return ['woman', 'child'];
  // children-only segment
  return ['child'];
}

export function defaultStudentTypeForSegment(segment: UserSegment): StudentTypeUI {
  if (segment === 'men') return 'man';
  if (segment === 'women') return 'woman';
  return 'child';
}

/**
 * Coerce UI student_type to a DB-valid value. The DB enum has no 'man'
 * literal, so we drop to null for men — the segment column already
 * records the gender authoritatively.
 */
export function submitStudentType(ui: StudentTypeUI | ''): StudentType | null {
  if (ui === 'man' || ui === '' ) return null;
  return ui as StudentType;
}

// ---------------- preferred_audience ----------------

export function audienceOptionsForSegment(segment: UserSegment): PreferredAudienceUI[] {
  if (segment === 'men') return ['men', 'children', 'both'];
  if (segment === 'women') return ['women', 'children', 'both'];
  return ['children', 'women', 'both'];
}

export function defaultAudienceForSegment(segment: UserSegment): PreferredAudienceUI {
  if (segment === 'men') return 'men';
  if (segment === 'women') return 'women';
  return 'children';
}

/**
 * Coerce UI preferred_audience to a DB-valid value. DB enum lacks 'men';
 * since the segment column marks the audience gender, map 'men' → 'both'
 * which semantically encompasses adult-male teaching plus family context.
 */
export function submitPreferredAudience(ui: PreferredAudienceUI): PreferredAudience {
  if (ui === 'men') return 'both';
  return ui;
}

// ---------------- i18n key helpers ----------------

/** i18n label key for a student_type UI option. */
export function studentTypeLabelKey(v: StudentTypeUI): string {
  // 'woman' → registration.woman, 'man' → registration.man, 'child' → registration.child
  return `registration.${v}`;
}

/** i18n label key for a preferred_audience UI option. */
export function audienceLabelKey(v: PreferredAudienceUI): string {
  // 'men' → registration.men, etc.
  return `registration.${v}`;
}
