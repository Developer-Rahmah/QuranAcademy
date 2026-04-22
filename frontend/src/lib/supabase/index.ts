/**
 * Public entrypoint for the Supabase data layer.
 *
 * Prefer the named modules in new code:
 *   import { supabase } from '@/lib/supabase/client';
 *   import { authApi } from '@/lib/supabase/auth';
 *   import * as api from '@/lib/supabase/api';
 *
 * The legacy `db` + `auth` objects below are kept as a compatibility facade so
 * existing callers (hooks, organisms, pages) keep compiling unchanged during
 * the data-layer refactor. They delegate to the typed api modules — no extra
 * logic lives here.
 */
export { supabase } from './client';
export type { AppSupabaseClient } from './client';
export { authApi } from './auth';
export * as api from './api';
export type * from './database.types';

// --------------- legacy compatibility facade ---------------
// TODO: delete once all callers have migrated to `api.*`.
import { profilesApi } from './api/profiles';
import { halaqahApi }  from './api/halaqah';
import { reportsApi }  from './api/reports';
import { authApi as _authApi } from './auth';
import type { UserRole, AccountStatus, HalaqahStatus } from '../../types';

export const auth = {
  signUp:             _authApi.signUp,
  signIn:             _authApi.signInWithPassword,
  signOut:            _authApi.signOut,
  getSession:         _authApi.getSession,
  getUser:            _authApi.getUser,
  resetPassword: (email: string) =>
    _authApi.resetPasswordForEmail(email, `${window.location.origin}/reset-password`),
  onAuthStateChange:  _authApi.onAuthStateChange,
};

export const db = {
  profiles: {
    get:    (userId: string) => profilesApi.getById(userId),
    create: profilesApi.create,
    update: profilesApi.update,
    // Legacy callers pass loose strings — coerce at the boundary.
    getAll: (filters: { role?: string; status?: string } = {}) =>
      profilesApi.list({
        role:   filters.role   as UserRole | undefined,
        status: filters.status as AccountStatus | undefined,
      }),
  },
  halaqahs: {
    get:    halaqahApi.getById,
    getAll: (filters: { teacherId?: string; status?: string } = {}) =>
      halaqahApi.list({
        teacherId: filters.teacherId,
        status:    filters.status as HalaqahStatus | undefined,
      }),
    create: halaqahApi.create,
    update: halaqahApi.update,
    delete: halaqahApi.remove,
  },
  members: {
    getByHalaqah: halaqahApi.members.byHalaqah,
    getByStudent: halaqahApi.members.forStudent,
    add:          halaqahApi.members.add,
    remove:       halaqahApi.members.remove,
  },
  reports: {
    getByStudent: reportsApi.byStudent,
    getByHalaqah: reportsApi.byHalaqah,
    create:       reportsApi.create,
    addItem:      reportsApi.addItem,
    addItems:     reportsApi.addItems,
  },
  stats: {
    getStudentProgress: reportsApi.stats.studentProgress,
    // Legacy caller expects a non-null AcademyStats even on error; fall back
    // to zeros so the existing hook's setState typing (non-nullable) keeps
    // working without UI changes.
    getAcademyStats: async () => {
      const { data, error } = await reportsApi.stats.academyStats();
      return {
        data: data ?? { totalStudents: 0, totalTeachers: 0, totalHalaqahs: 0 },
        error,
      };
    },
  },
};
