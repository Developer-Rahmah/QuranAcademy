/**
 * permissions — single source of truth for role-based capability checks.
 *
 * All UI gates and component-level guards MUST consult these helpers
 * instead of inlining `role === 'admin'` checks. This keeps the rules
 * in one place so a future role change is one edit, not a sweep.
 *
 * Server-side RLS is the ultimate authority — these helpers are for UX
 * (showing/hiding buttons, enabling/disabling forms). They must never be
 * the only line of defense.
 *
 * Capability matrix (current product spec):
 *
 *   Capability                  | admin | supervisor_manager | others
 *   ----------------------------|-------|--------------------|-------
 *   Manage halaqahs (CRUD)      |   ✅   |        ✅          |  no
 *   Manage halaqah students     |   ✅   |        ✅          |  no
 *   Manage halaqah supervisors  |   ✅   |        ✅          |  no
 *   Manage user account status  |   ✅   |        ✅          |  no
 *   View admin user list        |   ✅   |        ✅          |  no
 *   Delete users                |   ✅   |        no          |  no
 *   Assign role: admin          |   ✅   |        no          |  no
 *   Assign role: supervisor_mgr |   ✅   |        no          |  no
 *   Assign role: student/teacher|   ✅   |        ✅          |  no
 *   Access academy settings     |   ✅   |        no          |  no
 *   Contact students directly   |   ✅   |        ✅          |  teacher / halaqah_supervisor
 */
import type { UserRole } from '../types';

/** Narrow `role` argument shape used by every helper. */
export type RoleInput = UserRole | string | null | undefined;

/** Halaqah CRUD: create, edit, delete. */
export function canManageHalaqah(role: RoleInput): boolean {
  return role === 'admin' || role === 'supervisor_manager';
}

/** Add/remove students inside a halaqah. */
export function canManageHalaqahStudents(role: RoleInput): boolean {
  return role === 'admin' || role === 'supervisor_manager';
}

/** Assign / remove halaqah supervisors. */
export function canManageSupervisors(role: RoleInput): boolean {
  return role === 'admin' || role === 'supervisor_manager';
}

/**
 * Activate / deactivate / suspend user accounts globally (admin users
 * page). Admin + supervisor_manager only — teachers and halaqah
 * supervisors must never reach this surface.
 */
export function canManageUserStatus(role: RoleInput): boolean {
  return role === 'admin' || role === 'supervisor_manager';
}

/**
 * Activate / deactivate STUDENT accounts that the viewer manages.
 *
 * Returns true if the viewer is granted scoped activation rights:
 *   admin / supervisor_manager → ANY student (no scope).
 *   teacher                    → students in their halaqahs.
 *   halaqah_supervisor         → students in halaqahs they supervise.
 *
 * IMPORTANT — RELATIONAL SUPERVISOR HANDLING. Halaqah supervision is
 * driven by rows in `halaqah_supervisors`, NOT by `profiles.role`. The
 * vast majority of supervisors in production carry `profile.role =
 * 'student'` plus a row in `halaqah_supervisors` (dual-role pattern).
 * Looking only at `role` would hide the activation buttons from those
 * users on SupervisorDashboard / HalaqahDetails.
 *
 * The optional `opts.isSupervisor` lets the caller signal that the
 * viewer is a relational supervisor regardless of `profile.role`. Pass
 * it whenever you have evidence the user is a supervisor (presence of
 * an assignment row, being on a supervisor-only surface, etc).
 *
 * The actual per-student scope check lives server-side in the
 * `set_student_status` RPC (migration 0012), which enforces the
 * halaqah-level rules independently of this helper. That double-check
 * is deliberate — frontend hides the button, backend refuses the
 * mutation, so a tampered client can't widen access.
 */
export function canManageStudentActivation(
  role: RoleInput,
  opts: { isSupervisor?: boolean } = {},
): boolean {
  if (opts.isSupervisor) return true;
  return (
    role === 'admin' ||
    role === 'supervisor_manager' ||
    role === 'teacher' ||
    role === 'halaqah_supervisor'
  );
}

/**
 * Spec-named alias of `canManageStudentActivation`. Same semantics —
 * exposed under both names so call-sites can read naturally:
 *
 *   if (canToggleStudentActivation(role)) { ... }
 *
 * The backend RPC (`set_student_status`, migration 0012) enforces the
 * per-student scope — this client-side helper only gates UI affordance.
 */
export const canToggleStudentActivation = canManageStudentActivation;

/**
 * Generic "can act on a student account in a managed scope".
 *
 * Currently aliased to `canManageStudentActivation` because account
 * activation is the only per-student action delegated to teachers /
 * halaqah supervisors. If we ever add more student-scoped actions
 * (e.g. resetting password, editing fields), they go here so call
 * sites don't need to know which sub-rule applies.
 */
export const canManageStudent = canManageStudentActivation;

/** Hard-delete user records. Admin only. */
export function canDeleteUsers(role: RoleInput): boolean {
  return role === 'admin';
}

/** Read or write academy-wide settings. Admin only. */
export function canManageSettings(role: RoleInput): boolean {
  return role === 'admin';
}

/**
 * Contact students directly (WhatsApp / phone). Granted to anyone
 * responsible for halaqah oversight: admin, supervisor_manager,
 * teachers, and halaqah supervisors.
 */
export function canContactStudents(role: RoleInput): boolean {
  return (
    role === 'admin' ||
    role === 'supervisor_manager' ||
    role === 'teacher' ||
    role === 'halaqah_supervisor'
  );
}

/**
 * Whether the current viewer can grant a particular target role to a user.
 *
 *   admin                → can grant anything
 *   supervisor_manager   → can grant student / teacher only (no escalation
 *                          to admin or supervisor_manager)
 *   anyone else          → cannot reach the role-change UI at all
 */
export function canAssignRole(viewer: RoleInput, target: UserRole): boolean {
  if (viewer === 'admin') return true;
  if (viewer === 'supervisor_manager') {
    return target === 'student' || target === 'teacher';
  }
  return false;
}

/** Generic admin-or-supervisor-manager visibility gate. */
export function isAdminOrSupervisorManager(role: RoleInput): boolean {
  return role === 'admin' || role === 'supervisor_manager';
}

/**
 * The single authoritative test for "is this user a halaqah supervisor".
 *
 * IMPORTANT: supervisor status is RELATIONAL — driven by rows in the
 * `halaqah_supervisors` table, NOT by `profiles.role`. So a user is
 * a supervisor iff they have at least one assignment row, regardless of
 * what their profile.role says. This protects us against:
 *
 *   - admin assigning supervisor without inserting a row (bug fix);
 *   - admin manually editing profiles.role in the DB (data drift);
 *   - a former supervisor whose assignments were revoked but role kept.
 *
 * Pass the assignments list (or just its length) — anything truthy with
 * a `length > 0` qualifies. The signature is generic so callers don't
 * need to import the row type just to ask the question.
 */
export function isUserSupervisor(
  assignments: ReadonlyArray<unknown> | { length: number } | null | undefined,
): boolean {
  if (!assignments) return false;
  return assignments.length > 0;
}

export const permissions = {
  canManageHalaqah,
  canManageHalaqahStudents,
  canManageSupervisors,
  canManageUserStatus,
  canManageStudentActivation,
  canToggleStudentActivation,
  canManageStudent,
  canDeleteUsers,
  canManageSettings,
  canContactStudents,
  canAssignRole,
  isAdminOrSupervisorManager,
  isUserSupervisor,
};

export default permissions;
