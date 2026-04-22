/**
 * segmentationRules — single source of truth for gender/segment logic.
 *
 * Every gendered piece of UI in the app should call into one of the
 * functions here. No component should ever inspect `profile.role` or
 * `profile.segment` to derive a label/option list directly.
 *
 * Returns are i18n KEYS, not literal strings — the caller is expected to
 * pass them through `t(...)`. Two reasons:
 *   1. AR/EN coverage stays consistent.
 *   2. Tests can assert on stable keys.
 *
 * No "default to female" behaviour exists in this file. Anywhere segment
 * is missing/unknown the engine returns *neutral* keys; never a gendered
 * fallback.
 */
import { UserSegment, AudienceType } from './enums';
import type { UserRole } from '../types';

// ---------------- Inputs --------------------------------------------------

/**
 * Anything carrying enough info to make a labelling decision. Both real
 * `Profile` rows and synthetic shapes (e.g. a halaqah's `{ segment }`)
 * satisfy this — that's how HalaqahForm/Details can drive their UI from
 * the same engine without depending on a profile.
 */
export interface SegmentSubject {
  role?: UserRole | null;
  segment?: string | null;
}

// ---------------- Coercion helpers ---------------------------------------

/**
 * Project an arbitrary input into the closed UserSegment enum.
 * Admin role always wins over the segment column (admins never get
 * gendered labels regardless of what's stored in `profiles.segment`).
 * Unknown segments return `null` — the engine then falls back to neutral.
 */
function resolveSegment(subject: SegmentSubject): UserSegment | null {
  if (subject.role === 'admin') return UserSegment.ADMIN;
  if (subject.segment === UserSegment.MEN)   return UserSegment.MEN;
  if (subject.segment === UserSegment.WOMEN) return UserSegment.WOMEN;
  return null;
}

// ---------------- A. getUserRoleLabel ------------------------------------

/**
 * i18n key for the role label.
 *
 *   admin                  → 'auth.admin'    ("مشرف" / "Admin")
 *   teacher + men/women    → 'auth.teacherMale'  / 'auth.teacherFemale'
 *   student + men/women    → 'auth.studentMale'  / 'auth.studentFemale'
 *   teacher/student + ?    → 'auth.teacher' / 'auth.student' (neutral)
 *
 * Admin NEVER falls through to student/teacher labels.
 */
export function getUserRoleLabel(subject: SegmentSubject): string {
  const seg = resolveSegment(subject);
  if (seg === UserSegment.ADMIN) return 'auth.admin';

  if (subject.role === 'teacher') {
    if (seg === UserSegment.MEN) return 'auth.teacherMale';
    if (seg === UserSegment.WOMEN) return 'auth.teacherFemale';
    return 'auth.teacher';
  }
  // default to student-side labels for non-teacher / non-admin
  if (seg === UserSegment.MEN) return 'auth.studentMale';
  if (seg === UserSegment.WOMEN) return 'auth.studentFemale';
  return 'auth.student';
}

// ---------------- B. getGenderedUI ---------------------------------------

export type Pronoun = 'male' | 'female' | 'neutral';

export interface GenderedUI {
  pronoun: Pronoun;
  /** i18n key for "the halaqah" with correct grammatical gender. */
  halaqahLabel: string;
  /** i18n key for "students" with correct grammatical gender. */
  studentsLabel: string;
  /** i18n key for the modal title when creating a halaqah. */
  createHalaqahTitle: string;
  /** i18n key for the modal title when editing a halaqah. */
  editHalaqahTitle: string;
  /** i18n key for the placeholder of the halaqah-name input. */
  halaqahNamePlaceholder: string;
  /** i18n key for the teacher-name field label. */
  teacherFieldLabel: string;
  /** i18n key for the teacher-select placeholder. */
  selectTeacherPlaceholder: string;
  /** i18n key for the "teacher required" validation error. */
  teacherRequiredError: string;
}

/**
 * Build the bundle of gendered UI strings for a subject. ALL keys returned
 * are i18n keys — pass through `t(key)` at the call site.
 *
 * `null` segment → neutral keys (NOT female). This is the explicit fix
 * for the bug where the UI defaulted to female when segment was unknown.
 */
export function getGenderedUI(subject: SegmentSubject): GenderedUI {
  const seg = resolveSegment(subject);

  if (seg === UserSegment.MEN) {
    return {
      pronoun: 'male',
      halaqahLabel:             'halaqah.halaqahLabelMale',
      studentsLabel:            'halaqah.studentsLabelMale',
      createHalaqahTitle:       'admin.createHalaqahMale',
      editHalaqahTitle:         'admin.editHalaqahMale',
      halaqahNamePlaceholder:   'admin.enterHalaqahNameMale',
      teacherFieldLabel:        'admin.teacherNameMale',
      selectTeacherPlaceholder: 'admin.selectTeacherMale',
      teacherRequiredError:     'admin.teacherRequiredMale',
    };
  }

  if (seg === UserSegment.WOMEN) {
    return {
      pronoun: 'female',
      halaqahLabel:             'halaqah.halaqahLabelFemale',
      studentsLabel:            'halaqah.studentsLabelFemale',
      createHalaqahTitle:       'admin.createHalaqahFemale',
      editHalaqahTitle:         'admin.editHalaqahFemale',
      halaqahNamePlaceholder:   'admin.enterHalaqahNameFemale',
      teacherFieldLabel:        'admin.teacherNameFemale',
      selectTeacherPlaceholder: 'admin.selectTeacherFemale',
      teacherRequiredError:     'admin.teacherRequiredFemale',
    };
  }

  // Neutral fallback — used when segment is unknown OR for admin users.
  return {
    pronoun: 'neutral',
    halaqahLabel:             'halaqah.halaqahLabelNeutral',
    studentsLabel:            'halaqah.studentsLabelNeutral',
    createHalaqahTitle:       'admin.createHalaqah',
    editHalaqahTitle:         'admin.editHalaqah',
    halaqahNamePlaceholder:   'admin.enterHalaqahName',
    teacherFieldLabel:        'halaqah.teacherName',
    selectTeacherPlaceholder: 'admin.selectTeacher',
    teacherRequiredError:     'admin.teacherRequired',
  };
}

// ---------------- C. getAllowedAudience ----------------------------------

/**
 * Allowed `preferred_audience` options for a given segment.
 *
 *   men    → [men, children, both]            (NEVER women)
 *   women  → [women, children, both]          (NEVER men)
 *   admin  → full set (admins manage everyone)
 *   ?      → full set (no gender constraint to enforce)
 *
 * Returns the AudienceType enum so callers can switch over it; values are
 * also valid as raw strings since this is a string enum.
 */
export function getAllowedAudience(
  segment: UserSegment | string | null | undefined,
): AudienceType[] {
  if (segment === UserSegment.MEN) {
    return [AudienceType.MEN, AudienceType.CHILDREN, AudienceType.BOTH];
  }
  if (segment === UserSegment.WOMEN) {
    return [AudienceType.WOMEN, AudienceType.CHILDREN, AudienceType.BOTH];
  }
  // admin / unknown → full set
  return [
    AudienceType.MEN,
    AudienceType.WOMEN,
    AudienceType.CHILDREN,
    AudienceType.BOTH,
  ];
}

/**
 * Default audience for a fresh form. Resets cleanly when segment changes.
 * Men → 'men'; women → 'women'; otherwise neutral 'both'.
 */
export function getDefaultAudience(
  segment: UserSegment | string | null | undefined,
): AudienceType {
  if (segment === UserSegment.MEN) return AudienceType.MEN;
  if (segment === UserSegment.WOMEN) return AudienceType.WOMEN;
  return AudienceType.BOTH;
}

// ---------------- D. getOppositeGenderLabel ------------------------------

/**
 * i18n key for the OPPOSITE gender's neutral role-style label. Used by UI
 * correction flows ("you've been viewing the wrong gender's listing —
 * switch to X?") and by tests to assert symmetric behaviour.
 *
 * For admin or unknown segments returns the neutral 'auth.student' since
 * there is no meaningful opposite.
 */
export function getOppositeGenderLabel(
  segment: UserSegment | string | null | undefined,
): string {
  if (segment === UserSegment.MEN) return 'segment.women';
  if (segment === UserSegment.WOMEN) return 'segment.men';
  return 'auth.student';
}

// ---------------- Convenience --------------------------------------------

/**
 * Strict membership check: is the given audience option allowed for the
 * given segment? Used in form onChange to block invalid combinations
 * defensively (UI already filters the option list, but this is a guard
 * against programmatic state changes).
 */
export function isAudienceAllowed(
  segment: UserSegment | string | null | undefined,
  audience: AudienceType | string,
): boolean {
  return getAllowedAudience(segment).includes(audience as AudienceType);
}

/**
 * Audience i18n label key. Mirrors the keys defined in registration.* —
 * exposed here so callers don't need a separate lookup table.
 */
export function audienceLabelKey(a: AudienceType | string): string {
  return `registration.${a}`;
}

export const segmentationRules = {
  getUserRoleLabel,
  getGenderedUI,
  getAllowedAudience,
  getDefaultAudience,
  getOppositeGenderLabel,
  isAudienceAllowed,
  audienceLabelKey,
};

export default segmentationRules;
