/**
 * Route constants + role-based routing helpers.
 * Single source of truth so PublicRoute, RoleGuard, DashboardDispatcher and
 * Login.tsx never disagree on where a given role should land.
 */
import type { UserRole } from '../types';

export const ROUTES = {
  /** Public landing page (marketing + CTAs). */
  home: '/',
  /** Login screen. Previously lived at `/`. */
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  success: '/success',
  registerStudent: '/register/student',
  registerTeacher: '/register/teacher',

  /** Neutral dashboard URL — dispatches to the role-specific home. */
  dashboard: '/dashboard',
  /** Admin home. */
  admin: '/admin',
  adminUsers: '/admin/users',
  adminUserDetail: '/admin/users/:id',
  adminSettings: '/admin/settings',
  halaqahDetails: '/halaqah/:id',
  reportNew: '/report/new',
} as const;

/** Build an /admin/users/:id URL from a user id. */
export function adminUserDetailPath(userId: string): string {
  return `/admin/users/${userId}`;
}

/**
 * Given a role, return the URL they should land on after login.
 * Admin gets a distinct URL; teacher and student share /dashboard
 * (the DashboardDispatcher renders the correct component there).
 */
export function dashboardPathForRole(role: UserRole | string | undefined): string {
  if (role === 'admin') return ROUTES.admin;
  return ROUTES.dashboard;
}
