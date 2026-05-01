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
 *   View admin user list        |   ✅   |        ✅          |  no
 *   Delete users                |   ✅   |        no          |  no
 *   Assign role: admin          |   ✅   |        no          |  no
 *   Assign role: supervisor_mgr |   ✅   |        no          |  no
 *   Assign role: student/teacher|   ✅   |        ✅          |  no
 *   Access academy settings     |   ✅   |        no          |  no
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

/** Hard-delete user records. Admin only. */
export function canDeleteUsers(role: RoleInput): boolean {
  return role === 'admin';
}

/** Read or write academy-wide settings. Admin only. */
export function canManageSettings(role: RoleInput): boolean {
  return role === 'admin';
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
  canDeleteUsers,
  canManageSettings,
  canAssignRole,
  isAdminOrSupervisorManager,
  isUserSupervisor,
};

export default permissions;
