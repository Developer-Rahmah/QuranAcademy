/**
 * uiText — single source of truth for gendered, count-aware UI copy.
 *
 * Every label in the product that varies by segment (men/women) or by
 * count (singular/plural) or by role (student/teacher/admin) MUST be
 * produced here. Returns are i18n KEYS, passed through `t(...)` at the
 * call site so AR/EN coverage stays symmetric and tests can assert on
 * stable keys.
 *
 * Admin short-circuit: role === admin ALWAYS returns `auth.admin`, never
 * gendered student/teacher labels, regardless of segment.
 *
 * Unknown segment → neutral keys. There is no "default to female" path.
 *
 * Consumers:
 *
 *   const { t } = useTranslation();
 *   const key = uiText.getManageStudentsLabel(halaqah.segment);
 *   return <h2>{t(key)}</h2>;
 */

import { Role } from '../types/enums';
import { toAudienceContext, type AudienceContext } from '../types/audience';

// ---------------- Types ---------------------------------------------------

export type Count = 'singular' | 'plural';
export type EntityType = 'student' | 'teacher' | 'halaqah';
/** @deprecated Use `AudienceContext` instead. Kept for legacy callers. */
export type Pronoun = 'male' | 'female' | 'neutral';

// ---------------- Internal helpers ---------------------------------------

/**
 * The unified input type every helper accepts. Callers may pass:
 *   - a strongly-typed `AudienceContext` ('men' | 'women' | 'mixed')
 *   - any segment-ish string/enum (coerced via `toAudienceContext`)
 *   - `null` / `undefined` (coerced to 'mixed')
 *
 * No other shape drives gendered UI copy anywhere in the codebase.
 */
export type AudienceInput = AudienceContext | string | null | undefined;

/** Project any AudienceInput → canonical AudienceContext. */
function resolve(audience: AudienceInput): AudienceContext {
  return toAudienceContext(audience);
}

/** Map AudienceContext → i18n key suffix. */
function suffixFor(audience: AudienceContext): 'Male' | 'Female' | 'Neutral' {
  if (audience === 'men') return 'Male';
  if (audience === 'women') return 'Female';
  return 'Neutral';
}

/** Build a `uiText.<prefix><Male|Female|Neutral>` i18n key. */
function key(prefix: string, audience: AudienceInput): string {
  return `uiText.${prefix}${suffixFor(resolve(audience))}`;
}

// ---------------- Public API ---------------------------------------------

/** i18n key for the student label, audience + count aware. */
export function getStudentLabel(audience: AudienceInput, count: Count = 'singular'): string {
  return key(count === 'plural' ? 'studentPlural' : 'studentSingular', audience);
}

/** i18n key for the teacher label, audience + count aware. */
export function getTeacherLabel(audience: AudienceInput, count: Count = 'singular'): string {
  return key(count === 'plural' ? 'teacherPlural' : 'teacherSingular', audience);
}

/** Admin short-circuit. Always `auth.admin` — never inherits gender. */
export function getAdminLabel(): string {
  return 'auth.admin';
}

/**
 * Role-aware label. The one-stop helper for badges / chips / identity
 * cards. Admin short-circuits; teacher/student routes through the
 * singular gendered label for the subject's audience.
 *
 * Always i18n keys — pass through `t()`.
 */
export function getRoleLabel(
  role: string | null | undefined,
  audience: AudienceInput,
): string {
  if (role === Role.ADMIN) return getAdminLabel();
  if (role === Role.TEACHER) return getTeacherLabel(audience, 'singular');
  return getStudentLabel(audience, 'singular');
}

/** i18n key for the halaqah's own title, audience-aware. */
export function getHalaqahTitle(audience: AudienceInput): string {
  return key('halaqahTitle', audience);
}

/** i18n key for the "Manage students" section title / button. */
export function getManageStudentsLabel(audience: AudienceInput): string {
  return key('manageStudents', audience);
}

/** i18n key for the "Search students" placeholder / title. */
export function getSearchStudentLabel(audience: AudienceInput): string {
  return key('searchStudents', audience);
}

/** i18n key for the "Assigned students" column / section. */
export function getAssignedParticipantsLabel(audience: AudienceInput): string {
  return key('assignedParticipants', audience);
}

/** i18n key for the "Available students" column / section. */
export function getAvailableParticipantsLabel(audience: AudienceInput): string {
  return key('availableParticipants', audience);
}

/**
 * i18n key for an empty-state message. `entity` selects student / teacher /
 * halaqah; the copy adapts to audience (AR) or stays neutral (EN).
 */
export function getEmptyStateText(entity: EntityType, audience: AudienceInput): string {
  if (entity === 'student') return key('emptyStudents', audience);
  if (entity === 'teacher') return key('emptyTeachers', audience);
  return key('emptyHalaqahs', audience);
}

// Re-export the core type so consumers can do:
//   import { uiText, type AudienceContext } from '@/lib/uiText';
export type { AudienceContext } from '../types/audience';
export { toAudienceContext } from '../types/audience';

// ---------------- Convenience bundle -------------------------------------

/**
 * Namespaced bundle so consumers can do `uiText.getStudentLabel(...)`
 * rather than importing each helper individually.
 */
export const uiText = {
  getStudentLabel,
  getTeacherLabel,
  getAdminLabel,
  getRoleLabel,
  getHalaqahTitle,
  getManageStudentsLabel,
  getSearchStudentLabel,
  getAssignedParticipantsLabel,
  getAvailableParticipantsLabel,
  getEmptyStateText,
};

export default uiText;
