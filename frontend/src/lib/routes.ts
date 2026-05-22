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
  /** Blog index (SEO content surface). */
  blog: '/blog',
  /** Single blog article — pattern with :slug param. */
  blogPost: '/blog/:slug',

  /** Neutral dashboard URL — dispatches to the role-specific home. */
  dashboard: '/dashboard',
  /** Admin home. */
  admin: '/admin',
  adminUsers: '/admin/users',
  adminUserDetail: '/admin/users/:id',
  adminSettings: '/admin/settings',
  halaqahDetails: '/halaqah/:id',
  reportNew: '/report/new',
  reportEdit: '/report/:id/edit',
} as const;

/** Build a /report/:id/edit URL for a report id. */
export function reportEditPath(reportId: string): string {
  return `/report/${reportId}/edit`;
}

/** Build a /blog/:slug URL for a blog post slug. */
export function blogPostPath(slug: string): string {
  return `/blog/${slug}`;
}

/** Build an /admin/users/:id URL from a user id. */
export function adminUserDetailPath(userId: string): string {
  return `/admin/users/${userId}`;
}

/**
 * Given a role, return the URL they should land on after login.
 *
 *   admin / supervisor_manager → /admin (admin dashboard)
 *   everything else            → /dashboard (DashboardDispatcher
 *                                resolves the right component there)
 */
export function dashboardPathForRole(role: UserRole | string | undefined): string {
  if (role === 'admin' || role === 'supervisor_manager') return ROUTES.admin;
  return ROUTES.dashboard;
}
