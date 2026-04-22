/**
 * roleRules — single source of truth for gender / role / audience rules.
 *
 * Every gendered piece of business logic in the app MUST pass through one
 * of these functions. No component should inspect `segment` or `role`
 * directly to derive a label, a student-type option, an audience option,
 * or an assignment decision.
 *
 * Returns i18n KEYS, not literal strings — callers pass them through
 * `t(...)`. This keeps AR/EN coverage symmetric and lets tests assert on
 * stable keys.
 *
 * No "default to female" behaviour. Unknown segments return neutral keys.
 */
import { UserSegment, AudienceType } from '../enums';
import type { UserRole } from '../../types';

// ---------------- Public enums / types -----------------------------------

/**
 * Gender segment as understood by the business rules in this module.
 *
 * Intentionally narrower than `types/enums.Segment` (which also contains
 * `MIXED`): rules like `getAllowedStudentTypes`, `getAllowedAudience`,
 * and `canStudentJoinHalaqah` only have meaning for an actual gender
 * (men / women). `MIXED` is a UI-rendering concept (neutral copy for
 * admin dashboards, halaqahs targeting "both", etc.) and must not enter
 * the rule-compatibility checks — those callsites treat a MIXED /
 * unknown segment as "no constraint to enforce" instead.
 */
export type Segment = UserSegment.MEN | UserSegment.WOMEN;

/** Everything a student_type column can be (UI-side, not DB-constrained). */
export type StudentType = 'man' | 'woman' | 'child';

/** Everything a halaqah audience can be. */
export type HalaqahAudience = AudienceType;

/** Narrow `unknown` → Segment for inputs that aren't statically typed. */
export function asSegment(v: unknown): Segment | null {
  return v === UserSegment.MEN || v === UserSegment.WOMEN
    ? (v as Segment)
    : null;
}

// ---------------- Address language / gender ------------------------------

export type AddressGender = 'male' | 'female';

/**
 * Returns the grammatical gender of the address language for a segment.
 * Consumers render something like "لغة المخاطب: مذكر / مؤنث" or can use
 * this value to pick between gendered copy.
 */
export function getAddressGender(
  segment: Segment | string | null | undefined,
): AddressGender {
  return segment === UserSegment.MEN ? 'male' : 'female';
}

/** i18n key for the address-language label (male/female variant). */
export function getAddressGenderLabelKey(
  segment: Segment | string | null | undefined,
): string {
  return getAddressGender(segment) === 'male'
    ? 'halaqah.addressLanguageMale'
    : 'halaqah.addressLanguageFemale';
}

// ---------------- Student types -------------------------------------------

/**
 * Which `student_type` values are valid for a segment.
 *
 *   men   → ['man', 'child']
 *   women → ['woman', 'child']
 *
 * Mixed-age segments are not defined by the spec, so nothing else is
 * allowed. Unknown segment → empty (fail-safe: no options means the UI
 * can't offer an invalid pick).
 */
export function getAllowedStudentTypes(segment: Segment | null | undefined): StudentType[] {
  if (segment === UserSegment.MEN) return ['man', 'child'];
  if (segment === UserSegment.WOMEN) return ['woman', 'child'];
  return [];
}

// ---------------- Halaqah audience ----------------------------------------

/**
 * Which `preferred_audience` values a halaqah/teacher may pick.
 *
 *   men   → men, children, both
 *   women → women, children, both
 *   else  → full set (admin tooling / neutral surfaces)
 *
 * Notably: men NEVER see 'women' and vice versa.
 */
export function getAllowedAudience(segment: Segment | null | undefined): HalaqahAudience[] {
  if (segment === UserSegment.MEN) {
    return [AudienceType.MEN, AudienceType.CHILDREN, AudienceType.BOTH];
  }
  if (segment === UserSegment.WOMEN) {
    return [AudienceType.WOMEN, AudienceType.CHILDREN, AudienceType.BOTH];
  }
  return [AudienceType.MEN, AudienceType.WOMEN, AudienceType.CHILDREN, AudienceType.BOTH];
}

// ---------------- Role labels ---------------------------------------------

/**
 * Role label i18n key. Admin short-circuits to 'auth.admin' — NEVER falls
 * through to student/teacher variants. For teacher/student, the segment
 * picks the gendered variant; unknown segment returns the neutral key.
 */
export function getRoleLabel(role: UserRole, segment?: Segment | string | null): string {
  if (role === 'admin') return 'auth.admin';
  const seg = asSegment(segment);
  if (role === 'teacher') {
    if (seg === UserSegment.MEN) return 'auth.teacherMale';
    if (seg === UserSegment.WOMEN) return 'auth.teacherFemale';
    return 'auth.teacher';
  }
  if (seg === UserSegment.MEN) return 'auth.studentMale';
  if (seg === UserSegment.WOMEN) return 'auth.studentFemale';
  return 'auth.student';
}

/**
 * Admin-only label — returns 'auth.admin' for admins, otherwise delegates
 * to `getRoleLabel` so callers can use a single function for every row in
 * a user table without writing conditionals.
 */
export function getAdminLabel(
  role: UserRole,
  segment?: Segment | string | null,
): string {
  if (role === 'admin') return 'auth.admin';
  return getRoleLabel(role, segment);
}

// ---------------- Assignment compatibility --------------------------------

/**
 * Decide whether a student can be added to a halaqah. Encapsulates the
 * spec rules so both UI disabling (`canStudentJoinHalaqah`) and error
 * messaging (`studentIncompatibilityReason`) stay in sync.
 *
 *   - Halaqah with no segment       → allowed (backward compat).
 *   - Student with no segment       → allowed (backward compat).
 *   - Halaqah men   + student women → BLOCKED.
 *   - Halaqah women + student men   → BLOCKED.
 *   - Child student                 → allowed regardless of halaqah segment
 *     IF halaqah audience includes CHILDREN or BOTH.
 */
export interface CompatibilitySubject {
  segment?: Segment | string | null;
  student_type?: StudentType | string | null;
}

export interface HalaqahCompatibilitySubject {
  segment?: Segment | string | null;
  target_audience?: HalaqahAudience | string | null;
}

export function canStudentJoinHalaqah(
  student: CompatibilitySubject,
  halaqah: HalaqahCompatibilitySubject,
): boolean {
  const hSeg = asSegment(halaqah.segment);
  const sSeg = asSegment(student.segment);

  // Backward-compat: if either side is un-tagged we don't block.
  if (!hSeg || !sSeg) {
    // If we do know the audience and it's gender-exclusive, still enforce.
    if (hSeg && halaqah.target_audience && halaqah.target_audience !== AudienceType.BOTH && halaqah.target_audience !== AudienceType.CHILDREN) {
      if (halaqah.target_audience !== hSeg) return false;
    }
    return true;
  }

  if (hSeg === sSeg) return true;

  // Children bridge across segments when the halaqah accepts children.
  if (student.student_type === 'child') {
    const audience = halaqah.target_audience;
    return audience === AudienceType.CHILDREN || audience === AudienceType.BOTH;
  }

  return false;
}

/** i18n key of the incompatibility reason, or `null` when compatible. */
export function studentIncompatibilityReason(
  student: CompatibilitySubject,
  halaqah: HalaqahCompatibilitySubject,
): string | null {
  return canStudentJoinHalaqah(student, halaqah)
    ? null
    : 'assignment.incompatibleGender';
}

// ---------------- Re-exports (convenience) --------------------------------

export { UserSegment, AudienceType };

export const roleRules = {
  getAddressGender,
  getAddressGenderLabelKey,
  getAllowedStudentTypes,
  getAllowedAudience,
  getRoleLabel,
  getAdminLabel,
  canStudentJoinHalaqah,
  studentIncompatibilityReason,
  asSegment,
};

export default roleRules;
